import type { ReactElement } from "@cdd-team/react";

export function SvgIcon(): ReactElement {
	return (
		<div class="svg-icon-demo">
			<svg viewBox="0 0 24 24" width="48" height="48" className="svg-icon" aria-hidden="true">
				<path
					d="M5 12.5 10 17.5 19 7"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<span>SVG icon</span>
		</div>
	);
}
