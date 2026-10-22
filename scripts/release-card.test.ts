import { describe, expect, test } from "bun:test";
import { type CardContext, type CardPackage, renderCard } from "./release-card.ts";

const ctx: CardContext = {
	repo: "frontend-packages",
	failedStage: "publish",
	stageKnown: true,
	integrationPassed: true,
	hasReport: true,
	runUrl: "https://example.test/run",
	changesUrl: "https://example.test/changes",
	recoveryUrl: "https://example.test/recovery",
	compatibility: {},
};

const pkg: CardPackage = {
	name: "@cdd-team/react",
	version: "1.4.0",
	previous: "1.3.0",
	bump: "minor",
	releaseUrl: "https://example.test/release",
	changelog: null,
	outcome: "unconfirmed",
};

describe("renderCard", () => {
	test("команда проверки неподтверждённой версии — отдельный блок кода shell без точки", () => {
		const { text } = renderCard([pkg], ctx, "unknown");

		expect(text).toContain(
			'Публикация не подтверждена, проверьте:\n<pre><code class="language-shell">npm view @cdd-team/react@1.4.0</code></pre>',
		);
	});
});
