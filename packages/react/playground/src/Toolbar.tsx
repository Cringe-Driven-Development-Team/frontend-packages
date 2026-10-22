import type { ReactElement } from "@cdd-team/react";
import type { ToolbarProps } from "./types.ts";

export function Toolbar({
							onAddViaRef,
							onFocusInputViaHandle,
							onReverse,
							onRotate,
							onSort,
							onToggleTheme,
							onOpenPortal,
							onSwapPortalOrder,
						}: ToolbarProps): ReactElement {
	return (
		<div class="actions">
			<button class="action" type="button" onClick={onAddViaRef}>
				Click Add via ref
			</button>
			<button class="action" type="button" onClick={onFocusInputViaHandle}>
				Focus input via handle
			</button>
			<button class="action" type="button" onClick={onReverse}>
				Reverse
			</button>
			<button class="action" type="button" onClick={onRotate}>
				Rotate
			</button>
			<button class="action" type="button" onClick={onSort}>
				Sort by key
			</button>
			<button class="action" type="button" onClick={onToggleTheme}>
				Toggle theme
			</button>
			<button class="action" type="button" onClick={onOpenPortal}>
				Open portal
			</button>
			<button class="action" type="button" onClick={onSwapPortalOrder}>
				Swap portals
			</button>
		</div>
	);
}
