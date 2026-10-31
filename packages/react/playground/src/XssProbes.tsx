import {
	Children,
	createElement,
	createRoot,
	useEffect,
	useRef,
	useState,
	type ReactElement,
} from "@cdd-team/react";

// Ручная проверка защиты от XSS: обычная лента выводит данные, которые вернул сервер.
// Вредоносные значения лежат в ответе public/api/feed.json, а не в коде компонента.
// Выполненный чужой код сообщает о себе событием «xss» и попадает в журнал.
type Feed = {
	profile: { name: string; website: string };
	widget: { title: string; props: Record<string, unknown> };
	banner: Record<string, unknown>;
	message: ReactElement;
	promo: Record<string, unknown>;
	embed: { code: string };
};

const SOURCES: Record<string, string> = {
	profile: "Ссылка на сайт в профиле (javascript:-URL)",
	widget: "Виджет с бэка (innerHTML в props)",
	banner: "Баннер из CMS (ONERROR в атрибутах)",
	message: "Сообщение-элемент из JSON (без $$typeof)",
	promo: "Промо-ссылка (href + protocol)",
	embed: "Встраиваемый скрипт счётчика (<script>)",
};

// Защищённая сборка отклоняет объект без $$typeof уже в Children.toArray.
function hasElementCheck(): boolean {
	try {
		Children.toArray([{ type: "b", key: null, props: { children: [] } }] as never);
		return false;
	} catch {
		return true;
	}
}

export function XssProbes(): ReactElement {
	const [response, setResponse] = useState("");
	const [feed, setFeed] = useState<Feed | null>(null);
	const [hits, setHits] = useState<string[]>([]);
	const [messageError, setMessageError] = useState<string | null>(null);
	const messageTarget = useRef<HTMLDivElement>(null);
	const protectedBuild = useRef(hasElementCheck()).current;

	useEffect(() => {
		function onHit(event: Event): void {
			const source = String((event as CustomEvent).detail);
			setHits((previous) => (previous.includes(source) ? previous : [...previous, source]));
		}

		window.addEventListener("xss", onHit);
		return () => window.removeEventListener("xss", onHit);
	}, []);

	useEffect(() => {
		void fetch("/api/feed.json")
			.then((result) => result.text())
			.then(setResponse);
	}, []);

	// Сообщение рендерится отдельным root, как встраиваемый блок с серверной разметкой.
	useEffect(() => {
		if (!feed || !messageTarget.current) {
			return;
		}

		const root = createRoot(messageTarget.current);
		try {
			root.render(feed.message);
		} catch (error) {
			setMessageError((error as Error).message);
		}
		return () => root.unmount();
	}, [feed]);

	function showFeed(): void {
		setHits([]);
		setMessageError(null);
		setFeed(JSON.parse(response) as Feed);
	}

	function hideFeed(): void {
		setFeed(null);
		setHits([]);
		setMessageError(null);
	}

	return (
		<section class="xss-probes">
			<h2>XSS: лента с данными от сервера</h2>
			<p class={protectedBuild ? "xss-build xss-build-safe" : "xss-build xss-build-unsafe"}>
				{protectedBuild
					? "Сборка с защитой от XSS (локальная, через bun link)"
					: "Сборка без защиты от XSS (версия из npm)"}
			</p>
			<label class="xss-response">
				Ответ сервера GET /api/feed.json — его можно править, как атакующий
				<textarea
					rows={10}
					value={response}
					onInput={(event: Event) => setResponse((event.target as HTMLTextAreaElement).value)}
				/>
			</label>
			<div class="xss-actions">
				<button type="button" onClick={showFeed} disabled={!response}>
					Показать ленту
				</button>
				<button type="button" onClick={hideFeed}>
					Скрыть ленту
				</button>
			</div>
			{feed ? (
				<div class="feed">
					<article class="feed-card">
						<h3>Автор: {feed.profile.name}</h3>
						<a href={feed.profile.website}>Сайт автора</a>
					</article>
					<article class="feed-card">
						<h3>{feed.widget.title}</h3>
						<div {...feed.widget.props} />
					</article>
					<article class="feed-card">
						<h3>Баннер</h3>
						<img {...feed.banner} />
					</article>
					<article class="feed-card">
						<h3>Сообщение</h3>
						<div ref={messageTarget} />
						{messageError ? <p class="xss-rejected">Сообщение отклонено: {messageError}</p> : null}
					</article>
					<article class="feed-card">
						<h3>Промо</h3>
						<a {...feed.promo}>Перейти к акции</a>
					</article>
					<article class="feed-card">
						<h3>Счётчик</h3>
						{createElement("script", null, feed.embed.code)}
					</article>
				</div>
			) : null}
			<div class={hits.length > 0 ? "xss-log xss-log-hit" : "xss-log"}>
				<strong>Журнал: выполнен код атакующего</strong>
				{hits.length > 0 ? (
					<ul>
						{hits.map((source) => (
							<li key={source}>{SOURCES[source] ?? source}</li>
						))}
					</ul>
				) : (
					<p>Чужой код не выполнялся.</p>
				)}
			</div>
		</section>
	);
}
