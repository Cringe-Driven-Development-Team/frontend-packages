import { createPortal, useEffect, useLayoutEffect, useRef, useState } from "@cdd-team/react";
import type { MouseEvent, ReactElement } from "@cdd-team/react";
import { Filters } from "./Filters.tsx";
import { ExternalStoreDemo } from "./ExternalStoreDemo.tsx";
import { Header } from "./Header.tsx";
import { nestedProviderDemoFixture } from "./NestedProviderDemo.tsx";
import { SelectiveDemo } from "./SelectiveDemo.tsx";
import { SvgIcon } from "./SvgIcon.tsx";
import { XssProbes } from "./XssProbes.tsx";
import { TodoList } from "./TodoList.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { ThemeContext, type Theme } from "./theme.ts";
import type { Filter, HeaderActions, Todo } from "./types.ts";

const initialTodos: Todo[] = [
	{ id: 1, text: "Run effects after commit", done: true },
	{ id: 2, text: "Clean up effect before deps change", done: false },
	{ id: 3, text: "Keep state and effects across moves", done: false },
];

let nextTodoId = 4;

function createTodoId(): number {
	const id = nextTodoId;
	nextTodoId += 1;
	return id;
}

let renderCount = 0;
let portalMoveTarget: HTMLDivElement | null = null;

function getPortalMoveTarget(): HTMLDivElement {
	if (!portalMoveTarget) {
		portalMoveTarget = document.createElement("div");
		portalMoveTarget.id = "portal-move-target";
		portalMoveTarget.className = "portal-move-target";
		document.body.appendChild(portalMoveTarget);
	}

	return portalMoveTarget;
}


export function App(): ReactElement {
	const [todos, setTodos] = useState(initialTodos);
	const [filter, setFilter] = useState<Filter>("all");
	const [showStats, setShowStats] = useState(true);
	const [theme, setTheme] = useState<Theme>("light");
	const [showPortal, setShowPortal] = useState(false);
	const [portalOrderReversed, setPortalOrderReversed] = useState(false);
	const addButtonRef = useRef<HTMLButtonElement>(null);
	const headerActionsRef = useRef<HeaderActions>(null);
	const portalDialogRef = useRef<HTMLDivElement>(null);
	const visibleTodos = getVisibleTodos(todos, filter);
	const completedCount = todos.filter((todo) => todo.done).length;
	const titleStatus = `${completedCount}/${todos.length} completed`;
	const portalMoveItems = portalOrderReversed
		? [
				{ id: "beta", label: "Portal B" },
				{ id: "alpha", label: "Portal A" },
				{ id: "gamma", label: "Portal C" },
			]
		: [
				{ id: "alpha", label: "Portal A" },
				{ id: "beta", label: "Portal B" },
				{ id: "gamma", label: "Portal C" },
			];


	renderCount += 1;

	useEffect(() => {
		document.title = titleStatus;
	}, [titleStatus]);

	useLayoutEffect(() => {
		const todoCount = document.querySelectorAll(".todo").length;
		console.log(`layout effect: ${todoCount} todo DOM nodes`);
	}, [visibleTodos.length]);

	useLayoutEffect(() => {
		if (!showPortal) {
			return;
		}

		const dialog = portalDialogRef.current;
		const backdrop = dialog?.closest(".portal-backdrop");
		console.log(
			`portal dialog ref: ${backdrop?.parentElement === document.body ? "attached" : "missing"}`,
		);
	}, [showPortal]);

	useEffect(() => {
		console.log(`subscribe filter "${filter}"`);

		return () => {
			console.log(`cleanup filter "${filter}"`);
		};
	}, [filter]);

	function addTodo(text: string): void {
		const id = createTodoId();
		const todoText = text || `State task ${id}`;

		setTodos((previousTodos) => [
			{
				id,
				text: todoText,
				done: false,
			},
			...previousTodos,
		]);
	}

	function addViaRef(): void {
		addButtonRef.current?.click();
	}

	function focusInputViaHandle(): void {
		headerActionsRef.current?.focusAddInput();
	}

	function toggleTodo(id: number): void {
		setTodos((previousTodos) =>
			previousTodos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
		);
	}

	function removeTodo(id: number): void {
		setTodos((previousTodos) => previousTodos.filter((todo) => todo.id !== id));
	}

	function reverseTodos(): void {
		setTodos((previousTodos) => [...previousTodos].reverse());
	}

	function rotateTodos(): void {
		setTodos((previousTodos) => {
			const [firstTodo, ...restTodos] = previousTodos;
			return firstTodo ? [...restTodos, firstTodo] : previousTodos;
		});
	}

	function sortTodos(): void {
		setTodos((previousTodos) => [...previousTodos].sort((left, right) => left.id - right.id));
	}

	function toggleStats(): void {
		setShowStats((visible) => !visible);
	}

	function toggleTheme(): void {
		setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
	}

	function openPortal(): void {
		setShowPortal(true);
	}

	function swapPortalOrder(): void {
		setPortalOrderReversed((isReversed) => !isReversed);
	}

	function closePortal(): void {
		setShowPortal(false);
	}

	return (
		<ThemeContext value={theme}>
			<main class="app">
				<section class="panel">
					<Header
						total={todos.length}
						completed={completedCount}
						titleStatus={titleStatus}
						showStats={showStats}
						renderCount={renderCount}
						ref={addButtonRef}
						actionsRef={headerActionsRef}
						onAdd={addTodo}
						onToggleStats={toggleStats}
					/>
					<Toolbar
						onAddViaRef={addViaRef}
						onFocusInputViaHandle={focusInputViaHandle}
						onReverse={reverseTodos}
						onRotate={rotateTodos}
						onSort={sortTodos}
						onToggleTheme={toggleTheme}
						onOpenPortal={openPortal}
						onSwapPortalOrder={swapPortalOrder}
					/>
					<Filters value={filter} onChange={setFilter} />
					<SelectiveDemo />
					<ExternalStoreDemo />
					<SvgIcon />
					<XssProbes />
					{nestedProviderDemoFixture}
					<TodoList todos={visibleTodos} onToggle={toggleTodo} onRemove={removeTodo} />
				</section>
			</main>
			{showPortal
				? createPortal(
						<div class="portal-backdrop" onClick={closePortal}>
							<div
								ref={portalDialogRef}
								class="portal-dialog"
								onClick={(event: MouseEvent) => event.stopPropagation()}
							>
								<strong>Portal content</strong>
								<span>Mounted in document.body, logically rendered by App.</span>
								<button class="primary" type="button" onClick={closePortal}>
									Close portal
								</button>
							</div>
						</div>,
						document.body,
					)
				: null}
			{portalMoveItems.map((item) =>
				createPortal(
					<div class={`portal-move-card ${item.id}`} data-portal-move-card={item.id}>
						<strong>{item.label}</strong>
						<span>DOM order follows logical portal order.</span>
					</div>,
					getPortalMoveTarget(),
					item.id,
				),
			)}
		</ThemeContext>
	);
}

function getVisibleTodos(todos: Todo[], filter: Filter): Todo[] {
	if (filter === "active") {
		return todos.filter((todo) => !todo.done);
	}

	if (filter === "done") {
		return todos.filter((todo) => todo.done);
	}

	return todos;
}
