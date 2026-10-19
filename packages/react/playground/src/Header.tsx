import { useImperativeHandle, useRef } from "@cdd-team/react";
import type { ReactElement, Ref } from "@cdd-team/react";
import { HeaderTitle } from "./HeaderTitle.tsx";
import { StatsPanel } from "./StatsPanel.tsx";
import type { HeaderProps } from "./types.ts";

export function Header({
	total,
	completed,
	titleStatus,
	showStats,
	renderCount,
	ref,
	actionsRef,
	onAdd,
	onToggleStats,
}: HeaderProps): ReactElement {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useImperativeHandle(actionsRef, () => ({
		focusAddInput: () => inputRef.current?.focus(),
	}));

	function setAddButtonRef(node: HTMLButtonElement | null): void {
		buttonRef.current = node;
		setExternalRef(ref, node);
	}

	function addTodoFromInput(): void {
		const input = inputRef.current;
		const text = input?.value.trim() ?? "";

		onAdd(text);

		if (input) {
			input.value = "";
		}
	}

	return (
		<header class="header">
			<div>
				<HeaderTitle total={total} completed={completed} renderCount={renderCount} />
				<p class="effect-status">document.title: {titleStatus}</p>
				{showStats ? <StatsPanel completed={completed} total={total} /> : null}
			</div>
			<div class="header-actions">
				<button class="secondary" type="button" onClick={onToggleStats}>
					{showStats ? "Hide stats" : "Show stats"}
				</button>
				<input
					ref={inputRef}
					class="quick-add"
					placeholder="Todo text"
					aria-label="Todo text"
				/>
				<button ref={setAddButtonRef} class="primary" type="button" onClick={addTodoFromInput}>
					Add todo
				</button>
			</div>
		</header>
	);
}

function setExternalRef(ref: Ref<HTMLButtonElement> | undefined, node: HTMLButtonElement | null): void {
	if (ref == null) {
		return;
	}

	if (typeof ref === "function") {
		ref(node);
		return;
	}

	ref.current = node;
}
