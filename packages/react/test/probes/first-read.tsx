import { createRoot, useSyncExternalStore } from "../../src/index.ts";

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
let subscriptions = 0;
let reads = 0;
let caught: Error | null = null;

const subscribe = (): (() => void) => {
	subscriptions += 1;
	return () => {
		subscriptions -= 1;
	};
};
const getSnapshot = (): string => {
	reads += 1;
	throw new Error("first render read");
};

function Reader() {
	const value = useSyncExternalStore(subscribe, getSnapshot);
	return <span>{value}</span>;
}

process.on("uncaughtException", (error) => {
	caught ??= error;
});

root.render(<Reader />);
const deadline = performance.now() + 2000;
while (caught === null && performance.now() < deadline) {
	await new Promise((resolve) => setTimeout(resolve, 5));
}
const html = container.innerHTML;
const subscriptionsBeforeUnmount = subscriptions;
root.unmount();
process.stdout.write(
	`${JSON.stringify({
		error: caught === null ? null : (caught as Error).message,
		html,
		subscriptions: subscriptionsBeforeUnmount,
		reads,
		subscriptionsAfterUnmount: subscriptions,
	})}\n`,
);
process.exit(0);
