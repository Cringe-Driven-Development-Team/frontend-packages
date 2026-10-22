import { describe, expect, test } from "bun:test";
import {
	createContext,
	createPortal,
	createRoot,
	memo,
	useContext,
	useEffect,
	useLayoutEffect,
	useState,
} from "../src/index.ts";
import type { ReactElement, RefObject } from "../src/index.ts";

describe("createPortal", () => {
	test("создаёт элемент портала с контейнером и нормализованными детьми", () => {
		const target = document.createElement("div");
		const portal = createPortal(["a", <b key="b" />, null], target, "k");

		expect(portal.$$typeof as symbol).toBe(Symbol.for("react.element"));
		expect(portal.type as symbol).toBe(Symbol.for("react.portal"));
		expect(portal.key).toBe("k");
		expect(portal.props.container).toBe(target);
		expect(portal.props.children).toHaveLength(2);
	});

	test("key по умолчанию — null", () => {
		expect(createPortal(<b />, document.createElement("div")).key).toBeNull();
	});
});

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

async function mount(element: ReactElement) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	root.render(element);
	await flush();

	return { container, root };
}

function createTarget(): HTMLDivElement {
	const target = document.createElement("div");
	document.body.appendChild(target);
	return target;
}

function click(container: ParentNode, selector = "button"): void {
	container.querySelector<HTMLElement>(selector)?.click();
}

describe("монтирование и обновление портала", () => {
	test("портал как корневой ребёнок", async () => {
		const target = createTarget();
		const { container, root } = await mount(createPortal(<p>x</p>, target));

		expect(target.innerHTML).toBe("<p>x</p>");
		expect(container.innerHTML).toBe("");
		root.unmount();
	});

	test("портал внутри host между соседями", async () => {
		const target = createTarget();
		const { container, root } = await mount(
			<div>
				<a />
				{createPortal(<p />, target)}
				<i />
			</div>,
		);

		expect(container.innerHTML).toBe("<div><a></a><i></i></div>");
		expect(target.innerHTML).toBe("<p></p>");
		root.unmount();
	});

	test("новый сосед перед порталом встаёт в основной DOM", async () => {
		const target = createTarget();

		function App() {
			const [show, setShow] = useState(false);
			return (
				<div>
					{show ? <a /> : null}
					{createPortal(<button onClick={() => setShow(true)}>show</button>, target)}
					<i />
				</div>
			);
		}

		const { container, root } = await mount(<App />);
		click(target);
		await flush();

		expect(container.innerHTML).toBe("<div><a></a><i></i></div>");
		expect(target.innerHTML).toBe("<button>show</button>");
		root.unmount();
	});

	test("дети портала обновляются при рендере родителя", async () => {
		const target = createTarget();

		function App() {
			const [count, setCount] = useState(0);
			return (
				<div>
					<button onClick={() => setCount(count + 1)}>inc</button>
					{createPortal(<p>{count}</p>, target)}
				</div>
			);
		}

		const { container, root } = await mount(<App />);
		click(container);
		await flush();

		expect(target.textContent).toBe("1");
		root.unmount();
	});

	test("setState внутри портала обновляет DOM в контейнере", async () => {
		const target = createTarget();

		function Counter() {
			const [count, setCount] = useState(0);
			return <button onClick={() => setCount(count + 1)}>{count}</button>;
		}

		const { root } = await mount(<div>{createPortal(<Counter />, target)}</div>);
		click(target);
		await flush();

		expect(target.textContent).toBe("1");
		root.unmount();
	});

	test("context читается по логическому дереву, в том числе через memo", async () => {
		const target = createTarget();
		const Ctx = createContext("a");

		function Reader() {
			return <span>{useContext(Ctx)}</span>;
		}
		const MemoReader = memo(Reader);

		function App() {
			const [value, setValue] = useState("a");
			return (
				<Ctx value={value}>
					<button onClick={() => setValue("b")}>b</button>
					{createPortal(
						<div>
							<Reader />
							<MemoReader />
						</div>,
						target,
					)}
				</Ctx>
			);
		}

		const { container, root } = await mount(<App />);
		expect(target.textContent).toBe("aa");
		click(container);
		await flush();

		expect(target.textContent).toBe("bb");
		root.unmount();
	});

	test("ref указывает на host внутри портала", async () => {
		const target = createTarget();
		const ref: RefObject<HTMLParagraphElement | null> = { current: null };
		const { root } = await mount(<div>{createPortal(<p ref={ref} />, target)}</div>);

		expect(ref.current).toBe(target.firstChild as HTMLParagraphElement);
		root.unmount();
	});

	test("эффекты внутри портала запускаются", async () => {
		const target = createTarget();
		const log: string[] = [];

		function Child() {
			useLayoutEffect(() => {
				log.push("layout");
			}, []);
			useEffect(() => {
				log.push("passive");
			}, []);
			return <p />;
		}

		const { root } = await mount(<div>{createPortal(<Child />, target)}</div>);

		expect(log).toEqual(["layout", "passive"]);
		root.unmount();
	});

	test("дети появляются в изначально пустом портале", async () => {
		const target = createTarget();

		function App() {
			const [show, setShow] = useState(false);
			return (
				<div>
					<button onClick={() => setShow(true)}>show</button>
					{createPortal(show ? <p /> : null, target)}
				</div>
			);
		}

		const { container, root } = await mount(<App />);
		expect(target.innerHTML).toBe("");
		click(container);
		await flush();

		expect(target.innerHTML).toBe("<p></p>");
		root.unmount();
	});

	test("контейнером может быть DocumentFragment", async () => {
		const fragment = document.createDocumentFragment();
		const { root } = await mount(<div>{createPortal(<p />, fragment)}</div>);

		expect(fragment.childNodes.length).toBe(1);
		root.unmount();
	});
});
