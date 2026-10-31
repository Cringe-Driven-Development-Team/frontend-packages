import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { memo, useLayoutEffect, useState } from "@cdd-team/react";
import {
	Outlet,
	RouterProvider,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	getRouteApi,
	redirect,
	useLoaderData,
	useMatch,
	useParams,
	useRouterState,
	type AnyRouter,
	type RouterState,
} from "../src/index.ts";
import { flush, mount } from "./utils.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
	for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function render(element: Parameters<typeof mount>[0]) {
	const view = await mount(element);
	cleanups.push(view.unmount);
	return view;
}

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
	const deadline = performance.now() + timeoutMs;
	while (!condition() && performance.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

/** Ловит ошибки, которые ушли мимо вызывающего кода: из микрозадач рендера и console.error. */
function captureErrors(): { errors: unknown[]; restore: () => void } {
	const errors: unknown[] = [];
	const onError = (error: unknown) => errors.push(error);
	const originalError = console.error;
	process.on("uncaughtException", onError);
	process.on("unhandledRejection", onError);
	console.error = (...args: unknown[]) => errors.push(args[0]);

	return {
		errors,
		restore: () => {
			process.off("uncaughtException", onError);
			process.off("unhandledRejection", onError);
			console.error = originalError;
		},
	};
}

/** Считает активные подписки на роутер: `subscribe` подменяется до первого рендера. */
function trackListeners(router: AnyRouter): { readonly count: number } {
	const subscribe = router.subscribe;
	let count = 0;
	router.subscribe = (listener) => {
		count += 1;
		const unsubscribe = subscribe(listener);
		return () => {
			count -= 1;
			return unsubscribe();
		};
	};

	return {
		get count() {
			return count;
		},
	};
}

function deferred<T = void>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function createApp(path = "/", options: { rootComponent?: () => ReturnType<typeof Outlet> } = {}) {
	const slow = { gate: deferred() };
	let rootLoads = 0;
	let invalidations = 0;

	const rootRoute = createRootRoute({
		loader: () => ({ user: "Ерофей", loads: ++rootLoads }),
		component:
			options.rootComponent ??
			(() => (
				<main>
					<Outlet />
				</main>
			)),
	});
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <h1>Главная</h1>,
	});
	const notebookRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "notebooks/$notebookId",
		loader: ({ params }) => ({ title: `Блокнот ${params.notebookId}`, version: invalidations }),
		component: function NotebookPage() {
			const { notebookId } = useParams();
			const { title, version } = notebookRoute.useLoaderData();
			return (
				<h1>
					{notebookId}:{title}:{version}
				</h1>
			);
		},
	});
	const slowRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "slow",
		loader: async () => {
			await slow.gate.promise;
			return "медленно";
		},
		component: () => <h1>{slowRoute.useLoaderData()}</h1>,
	});
	const oldRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "old",
		beforeLoad: () => {
			throw redirect({ to: "/notebooks/$notebookId", params: { notebookId: 9 } });
		},
	});

	const routeTree = rootRoute.addChildren([indexRoute, notebookRoute, slowRoute, oldRoute]);
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createRouter({ routeTree, history, defaultPendingMs: 10_000 });

	return {
		router,
		history,
		rootRoute,
		slow,
		bumpVersion: () => {
			invalidations += 1;
		},
		get rootLoads() {
			return rootLoads;
		},
	};
}

/** Компонент вне маршрутов: пишет закоммиченные выборки в `log`. */
function withProbe<T>(read: () => T) {
	const log: T[] = [];
	// memo: родитель перерисовывается вместе с маршрутами, а считать нужно только подписку
	const Probe = memo(function Probe() {
		const value = read();
		useLayoutEffect(() => {
			log.push(value);
		});
		return null;
	});
	const rootComponent = () => (
		<div>
			<Probe />
			<Outlet />
		</div>
	);
	return { log, rootComponent };
}

type Snapshot = {
	status: RouterState["status"];
	location: string;
	resolved: string | undefined;
	matches: string[];
};

function snapshotOf(state: RouterState): Snapshot {
	return {
		status: state.status,
		location: state.location.pathname,
		resolved: state.resolvedLocation?.pathname,
		matches: state.matches.map((match) => `${match.routeId}:${match.status}`),
	};
}

describe("Router.state как snapshot внешнего стора", () => {
	test("каждое изменение — новый объект, слушатели видят уже записанное состояние", async () => {
		const { router } = createApp("/");
		const seen: RouterState[] = [];
		router.subscribe(() => seen.push(router.state));
		const initial = router.state;

		await router.load();
		await router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 1 } });

		expect(seen.length).toBeGreaterThan(2);
		expect(new Set([initial, ...seen]).size).toBe(seen.length + 1);
		expect(seen.at(-1)).toBe(router.state);
		expect(router.state.status).toBe("idle");
	});
});

describe("useRouterState", () => {
	test("показывает location, matches, status и resolvedLocation на асинхронной загрузке", async () => {
		const probe = withProbe(() => snapshotOf(useRouterState()));
		const app = createApp("/", probe);
		await render(<RouterProvider router={app.router} />);
		expect(probe.log.at(-1)).toEqual({
			status: "idle",
			location: "/",
			resolved: "/",
			matches: ["__root__:success", "/:success"],
		});

		const navigation = app.router.navigate({ to: "/slow" });
		await flush();
		// Пока loader не ответил, адрес уже новый, а отрисованы прежние маршруты
		expect(probe.log.at(-1)).toEqual({
			status: "pending",
			location: "/slow",
			resolved: "/",
			matches: ["__root__:success", "/:success"],
		});

		app.slow.gate.resolve();
		await navigation;
		await flush();
		expect(probe.log.at(-1)).toEqual({
			status: "idle",
			location: "/slow",
			resolved: "/slow",
			matches: ["__root__:success", "/slow:success"],
		});
	});

	test("redirect и invalidate доходят до UI", async () => {
		const probe = withProbe(() => useRouterState({ select: (state) => state.location.pathname }));
		const app = createApp("/", probe);
		const { container } = await render(<RouterProvider router={app.router} />);

		await app.router.navigate({ to: "/old" });
		await flush();
		expect(probe.log.at(-1)).toBe("/notebooks/9");
		expect(app.history.location.pathname).toBe("/notebooks/9");
		expect(container.querySelector("h1")?.textContent).toBe("9:Блокнот 9:0");

		app.bumpVersion();
		await app.router.invalidate();
		await flush();
		expect(container.querySelector("h1")?.textContent).toBe("9:Блокнот 9:1");
	});

	test("неизменившаяся выборка не вызывает render", async () => {
		const probe = withProbe(() => useRouterState({ select: (state) => state.location.pathname }));
		const app = createApp("/notebooks/1", probe);
		await render(<RouterProvider router={app.router} />);
		const renders = probe.log.length;

		// invalidate дважды меняет состояние (pending → idle), адрес остаётся прежним
		await app.router.invalidate();
		await flush();
		expect(probe.log.length).toBe(renders);

		await app.router.navigate({ to: "/" });
		await flush();
		expect(probe.log.slice(renders)).toEqual(["/"]);
	});

	test("объектный selector: кеш для того же state, Object.is по умолчанию, isEqual сохраняет ссылку", async () => {
		const selectPath = (state: RouterState) => ({ path: state.location.pathname });
		const isSamePath = (previous: { path: string }, next: { path: string }) =>
			previous.path === next.path;
		const plain: Array<{ path: string }> = [];
		const equal: Array<{ path: string }> = [];
		let rerender = () => {};

		const Plain = memo(function Plain() {
			const [, setTick] = useState(0);
			useLayoutEffect(() => {
				rerender = () => setTick((tick) => tick + 1);
			}, []);
			const selected = useRouterState({ select: selectPath });
			useLayoutEffect(() => {
				plain.push(selected);
			});
			return null;
		});
		const Equal = memo(function Equal() {
			const selected = useRouterState({ select: selectPath, isEqual: isSamePath });
			useLayoutEffect(() => {
				equal.push(selected);
			});
			return null;
		});
		const app = createApp("/", {
			rootComponent: () => (
				<div>
					<Plain />
					<Equal />
				</div>
			),
		});
		await render(<RouterProvider router={app.router} />);
		const [plainBefore, equalBefore] = [plain.length, equal.length];
		const plainValue = plain.at(-1);

		// Тот же router.state: selector не пересчитывается, ссылка прежняя
		rerender();
		await flush();
		expect(plain.length).toBe(plainBefore + 1);
		expect(plain.at(-1)).toBe(plainValue!);

		// Новое состояние с тем же адресом: без isEqual новый объект перерисовывает компонент
		await app.router.invalidate();
		await flush();
		expect(plain.length).toBeGreaterThan(plainBefore + 1);
		expect(plain.at(-1)).not.toBe(plainValue!);
		expect(plain.at(-1)).toEqual(plainValue!);
		expect(equal.length).toBe(equalBefore);
		expect(equal.at(-1)).toBe(equal[0]!);
	});

	test("смена selector и isEqual пересчитывает выборку", async () => {
		const byPath = (state: RouterState) => state.location.pathname;
		const byStatus = (state: RouterState) => state.status;
		const sameLength = (previous: string, next: string) => previous.length === next.length;
		const neverEqual = () => false;
		const log: string[] = [];
		type Options = { select: (state: RouterState) => string; isEqual?: typeof sameLength };
		let setOptions: (options: Options) => void = () => {};

		function Reader() {
			const [options, set] = useState<Options>({ select: byPath, isEqual: sameLength });
			useLayoutEffect(() => {
				setOptions = set;
			}, []);
			const value = useRouterState(options);
			useLayoutEffect(() => {
				log.push(value);
			});
			return <p>{value}</p>;
		}
		const app = createApp("/notebooks/1", { rootComponent: () => <Reader /> });
		const { container } = await render(<RouterProvider router={app.router} />);
		expect(container.textContent).toBe("/notebooks/1");

		// Тот же по длине адрес: isEqual оставляет прежнюю выборку
		await app.router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 2 } });
		await flush();
		expect(container.textContent).toBe("/notebooks/1");

		setOptions({ select: byPath, isEqual: neverEqual });
		await flush();
		expect(container.textContent).toBe("/notebooks/2");

		setOptions({ select: byStatus });
		await flush();
		expect(container.textContent).toBe("idle");
	});

	test("смена роутера переключает подписку, unmount снимает все подписки", async () => {
		const log: string[] = [];
		function Reader() {
			const path = useRouterState({ select: (state) => state.location.pathname });
			useLayoutEffect(() => {
				log.push(path);
			});
			return <p>{path}</p>;
		}
		const first = createApp("/notebooks/1", { rootComponent: () => <Reader /> });
		const second = createApp("/notebooks/2", { rootComponent: () => <Reader /> });
		const firstListeners = trackListeners(first.router);
		const secondListeners = trackListeners(second.router);
		let switchRouter = () => {};

		function App() {
			const [router, setRouter] = useState<AnyRouter>(first.router);
			useLayoutEffect(() => {
				switchRouter = () => setRouter(second.router);
			}, []);
			return <RouterProvider router={router} />;
		}
		const view = await mount(<App />);
		expect(view.container.textContent).toBe("/notebooks/1");
		expect(firstListeners.count).toBeGreaterThan(0);

		switchRouter();
		await flush();
		await waitFor(() => view.container.textContent === "/notebooks/2");
		expect(view.container.textContent).toBe("/notebooks/2");
		expect(firstListeners.count).toBe(0);
		expect(secondListeners.count).toBeGreaterThan(0);

		// Старый роутер больше не перерисовывает дерево
		const renders = log.length;
		await first.router.navigate({ to: "/" });
		await flush();
		expect(log.length).toBe(renders);

		await view.unmount();
		expect(secondListeners.count).toBe(0);
	});
});

describe("хуки совпадения маршрута", () => {
	test("подписчик поля match не перерисовывается при обновлении другого match", async () => {
		const renders = { loaderData: 0 };
		const app = createApp("/notebooks/1", {
			rootComponent: () => (
				<div>
					<RootData />
					<Outlet />
				</div>
			),
		});
		const rootApi = getRouteApi("__root__");
		const RootData = memo(function RootData() {
			const data = rootApi.useLoaderData();
			useLayoutEffect(() => {
				renders.loaderData += 1;
			});
			return <p>{`${data.user}:${data.loads}`}</p>;
		});
		const { container } = await render(<RouterProvider router={app.router} />);
		expect(container.querySelector("p")?.textContent).toBe("Ерофей:1");
		const before = renders.loaderData;

		// Переход между дочерними маршрутами: данные корня загружены и не меняются
		await app.router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 2 } });
		await flush();
		expect(container.querySelector("h1")?.textContent).toBe("2:Блокнот 2:0");
		expect(renders.loaderData).toBe(before);
		expect(app.rootLoads).toBe(1);

		// Своё значение доходит до UI
		await app.router.invalidate();
		await flush();
		expect(container.querySelector("p")?.textContent).toBe("Ерофей:2");
	});

	test("useMatch, useParams и useLoaderData с from читают нужный маршрут", async () => {
		function Reader() {
			const match = useMatch({ from: "/notebooks/$notebookId" });
			const params = useParams({ from: "/notebooks/$notebookId" });
			const data = useLoaderData({ from: "/notebooks/$notebookId" }) as { title: string };
			return <p>{`${match.routeId}:${params.notebookId}:${data.title}`}</p>;
		}
		// Reader стоит в корне рядом с Outlet и читает дочерний маршрут по from
		const app = createApp("/notebooks/3", {
			rootComponent: () => (
				<div>
					<Reader />
					<Outlet />
				</div>
			),
		});
		const { container } = await render(<RouterProvider router={app.router} />);
		const reader = container.querySelector("p");
		expect(reader?.textContent).toBe("/notebooks/$notebookId:3:Блокнот 3");
	});

	test("без совпадения хук бросает прежнюю ошибку и не оставляет подписок", async () => {
		// Ошибка рендера уходит в uncaughtException: проверяем её в отдельном процессе
		const probe = Bun.spawn(
			["bun", "--preload", "./test/setup-dom.ts", "./test/probes/missing-match.tsx"],
			{ cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
		);
		const output = await new Response(probe.stdout).text();
		await probe.exited;

		expect(JSON.parse(output.trim().split("\n").at(-1) ?? "null")).toEqual({
			error: 'Маршрут "/notebooks/$notebookId" сейчас не отрисован',
			listenersAfterUnmount: 0,
		});
	});
});

describe("гонки внешнего стора", () => {
	test("изменение между render и подпиской не оставляет устаревший commit", async () => {
		const committed: string[] = [];
		let navigated = false;
		function Reader() {
			const path = useRouterState({ select: (state) => state.location.pathname });
			useLayoutEffect(() => {
				committed.push(path);
			});
			return (
				<p>
					{path}
					<Navigator />
				</p>
			);
		}
		function Navigator() {
			const app = appRef.current!;
			// Layout effect ребёнка выполняется раньше подписки родителя
			useLayoutEffect(() => {
				if (navigated) return;
				navigated = true;
				void app.router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 4 } });
			}, [app]);
			return null;
		}
		const appRef: { current?: ReturnType<typeof createApp> } = {};
		appRef.current = createApp("/", { rootComponent: () => <Reader /> });
		const { container } = await render(<RouterProvider router={appRef.current.router} />);

		await waitFor(() => container.textContent === "/notebooks/4");
		expect(container.textContent).toBe("/notebooks/4");
		expect(committed.at(-1)).toBe("/notebooks/4");
	});

	test("изменение во время прерванного render не коммитит смешанные данные", async () => {
		const committed: string[] = [];
		const controls = { paused: false, start: () => {} };
		let app!: ReturnType<typeof createApp>;
		const interruptOnce = () => {
			if (controls.paused) return;
			controls.paused = true;
			queueMicrotask(() => {
				void app.router.navigate({ to: "/notebooks/$notebookId", params: { notebookId: 5 } });
			});
			const until = performance.now() + 8;
			while (performance.now() < until) continue;
		};
		function A(props: { pause: boolean }) {
			const path = useRouterState({ select: (state) => state.location.pathname });
			if (props.pause) interruptOnce();
			useLayoutEffect(() => {
				committed.push(document.querySelector("#race")?.textContent ?? "");
			});
			return <span>{path}</span>;
		}
		function B() {
			const path = useRouterState({ select: (state) => state.location.pathname });
			useLayoutEffect(() => {
				committed.push(document.querySelector("#race")?.textContent ?? "");
			});
			return <span>{path}</span>;
		}
		function Race() {
			const [pause, setPause] = useState(false);
			useLayoutEffect(() => {
				controls.start = () => setPause(true);
			}, []);
			return (
				<div id="race">
					<A pause={pause} />|<B />
				</div>
			);
		}
		app = createApp("/", { rootComponent: () => <Race /> });
		const { container } = await render(<RouterProvider router={app.router} />);
		expect(container.textContent).toBe("/|/");
		committed.length = 0;

		controls.start();
		await waitFor(() => container.textContent === "/notebooks/5|/notebooks/5");
		expect(container.textContent).toBe("/notebooks/5|/notebooks/5");
		for (const text of committed) {
			const [a, b] = text.split("|");
			expect(a).toBe(b!);
		}
	});

	test("исчезновение match размонтирует старый маршрут без синхронной ошибки", async () => {
		const captured = captureErrors();
		try {
			const app = createApp("/notebooks/6");
			const { container } = await render(<RouterProvider router={app.router} />);
			expect(container.querySelector("h1")?.textContent).toBe("6:Блокнот 6:0");

			let navigation!: Promise<void>;
			expect(() => {
				navigation = app.router.navigate({ to: "/" });
			}).not.toThrow();
			await navigation;
			await flush();

			expect(container.innerHTML).toBe("<main><h1>Главная</h1></main>");
			expect(captured.errors).toEqual([]);
		} finally {
			captured.restore();
		}
	});
});
