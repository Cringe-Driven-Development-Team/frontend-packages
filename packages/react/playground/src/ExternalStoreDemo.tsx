import { useState } from "@cdd-team/react";
import type { ReactElement } from "@cdd-team/react";
import { counterStore, useStore } from "./external-store.ts";

function CountReader({ label }: { label: string }): ReactElement {
	const count = useStore(counterStore, state => state.count);
	return <p>{label}: <strong>{count}</strong></p>;
}

export function ExternalStoreDemo(): ReactElement {
	const [showSecond, setShowSecond] = useState(true);
	return (
		<section class="external-store-demo">
			<h2>Внешний стор</h2>
			<p>Оба компонента читают один снимок. Скрытие второго снимает только его подписку.</p>
			<CountReader label="Первый читатель" />
			{showSecond ? <CountReader label="Второй читатель" /> : null}
			<button type="button" onClick={() => counterStore.setState(state => ({ count: state.count + 1 }))}>Увеличить стор</button>
			<button type="button" onClick={() => setShowSecond(value => !value)}>{showSecond ? "Скрыть" : "Показать"} второго</button>
		</section>
	);
}
