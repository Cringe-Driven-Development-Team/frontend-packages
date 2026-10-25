// Отдельный процесс: ошибка из work loop всплывает как uncaughtException, а bun test засчитал бы её провалом.
import { createRoot, type ReactElement } from "../../src/index.ts";

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
const fake = JSON.parse('{"type":"div","key":null,"props":{"children":[]}}') as ReactElement;
let caught: string | null = null;
let bad = false;

process.on("uncaughtException", (error) => {
	caught = error.message;
});

async function flush(): Promise<void> {
	for (let i = 0; i < 10; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function App(): ReactElement {
	return bad ? fake : <p>ok</p>;
}

root.render(<App />);
await flush();
const before = container.firstChild;

bad = true;
root.render(<App />);
await flush();
const sameNode = container.firstChild === before;
const html = container.innerHTML;

bad = false;
root.render(<p>next</p>);
await flush();

console.log(JSON.stringify({ error: caught, sameNode, html, recovered: container.innerHTML }));
process.exit(0);
