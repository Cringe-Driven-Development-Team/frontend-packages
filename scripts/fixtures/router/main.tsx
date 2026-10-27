import { createRoot } from "@cdd-team/react";
import { Link, RouterProvider, createBrowserHistory, useParams } from "@cdd-team/router";
import { makeRouter } from "./routes";

// Проверки типов на установленном архиве: путь и параметры сверяются с зарегистрированным деревом
export function TypedLinks() {
	const { notebookId } = useParams({ from: "/notebooks/$notebookId" });
	return (
		<nav>
			<Link to="/notebooks/$notebookId" params={{ notebookId }}>
				Блокнот
			</Link>
			{/* @ts-expect-error: такого пути нет в дереве */}
			<Link to="/missing">Нет</Link>
			{/* @ts-expect-error: путь с параметром требует params */}
			<Link to="/notebooks/$notebookId">Без params</Link>
		</nav>
	);
}

// @ts-expect-error: внутренние файлы закрыты полем exports
export type Internal = typeof import("@cdd-team/router/dist/index.mjs");

createRoot(document.body).render(<RouterProvider router={makeRouter(createBrowserHistory())} />);
