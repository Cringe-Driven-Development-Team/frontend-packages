import { createRoot, useRef, useState, type ReactElement } from "@cdd-team/react";

// Ручная проверка защиты от XSS. Успешная атака меняет заголовок вкладки на «XSS: <проба>».
// На опубликованной версии без защиты атаки срабатывают, на локальной сборке через bun link — нет.
const INITIAL_TITLE = "playground";

const htmlProps: Record<string, unknown> = {
	innerHTML: `<img src="x" onerror="document.title='XSS: html'">`,
};
const spreadProps: Record<string, unknown> = {
	src: "x",
	ONERROR: "document.title='XSS: onerror'",
};
const jsonElement = `{"type":"img","key":null,"props":{"src":"x","ONERROR":"document.title='XSS: json'","children":[]}}`;

export function XssProbes(): ReactElement {
	const [showHtml, setShowHtml] = useState(false);
	const [showSpread, setShowSpread] = useState(false);
	const [jsonStatus, setJsonStatus] = useState("не запускалась");
	const jsonTarget = useRef<HTMLDivElement>(null);

	function renderJson(): void {
		if (!jsonTarget.current) {
			return;
		}

		try {
			createRoot(jsonTarget.current).render(JSON.parse(jsonElement) as ReactElement);
			setJsonStatus("элемент принят рендерером");
		} catch (error) {
			setJsonStatus(`отклонён: ${(error as Error).message}`);
		}
	}

	function reset(): void {
		document.title = INITIAL_TITLE;
		setShowHtml(false);
		setShowSpread(false);
		setJsonStatus("не запускалась");
	}

	return (
		<section class="xss-probes">
			<h2>XSS probes</h2>
			<p>Успешная атака меняет заголовок вкладки на «XSS: …».</p>
			<ol>
				<li>
					<a href="javascript:document.title='XSS: url'">1. Ссылка javascript:</a>
				</li>
				<li>
					<button type="button" onClick={() => setShowHtml(true)}>
						2. HTML-prop innerHTML
					</button>
					{showHtml ? <div {...htmlProps} /> : null}
				</li>
				<li>
					<button type="button" onClick={renderJson}>
						3. JSON-элемент
					</button>
					<span> {jsonStatus}</span>
					<div ref={jsonTarget} />
				</li>
				<li>
					<button type="button" onClick={() => setShowSpread(true)}>
						4. ONERROR из spread
					</button>
					{showSpread ? <img alt="" {...spreadProps} /> : null}
				</li>
			</ol>
			<button type="button" onClick={reset}>
				Сбросить
			</button>
		</section>
	);
}
