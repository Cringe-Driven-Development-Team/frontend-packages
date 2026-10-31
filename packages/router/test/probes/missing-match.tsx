import { createRoot } from "@cdd-team/react";
import {
	RouterProvider,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	useParams,
} from "../../src/index.ts";

function Reader() {
	useParams({ from: "/notebooks/$notebookId" });
	return null;
}

const rootRoute = createRootRoute({ component: () => <Reader /> });
const notebookRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "notebooks/$notebookId",
});
const router = createRouter({
	routeTree: rootRoute.addChildren([notebookRoute]),
	history: createMemoryHistory({ initialEntries: ["/"] }),
});

let listeners = 0;
const subscribe = router.subscribe;
router.subscribe = (listener) => {
	listeners += 1;
	const unsubscribe = subscribe(listener);
	return () => {
		listeners -= 1;
		return unsubscribe();
	};
};

let caught: Error | null = null;
process.on("uncaughtException", (error) => {
	caught ??= error;
});

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(<RouterProvider router={router} />);

const deadline = performance.now() + 2000;
while (caught === null && performance.now() < deadline) {
	await new Promise((resolve) => setTimeout(resolve, 5));
}
root.unmount();
await new Promise((resolve) => setTimeout(resolve, 0));

process.stdout.write(
	`${JSON.stringify({
		error: caught === null ? null : (caught as Error).message,
		listenersAfterUnmount: listeners,
	})}\n`,
);
process.exit(0);
