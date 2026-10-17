import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

/** Правило плагина, которое включается в конфиге oxlint. */
export type RuleName = "require-jsdoc" | "check-param-names";

/** Один проверяемый фрагмент кода; `filename` с расширением `.ts` включает TypeScript-синтаксис. */
export type LintCase = { code: string; filename?: string };

/** Диагностика плагина: текст и строка. */
export type PluginDiagnostic = { message: string; line: number };

type OxlintOutput = {
	diagnostics: Array<{
		message: string;
		code: string;
		filename: string;
		labels: Array<{ span: { line: number; column: number } }>;
	}>;
};

const pluginEntry = resolve(import.meta.dir, "../../dist/index.mjs");

/**
 * Прогоняет кейсы через CLI oxlint с собранным плагином: один запуск на пачку.
 * Для i-го кейса возвращает диагностики правила, отсортированные по позиции (строка, столбец).
 */
export async function lintCases(rule: RuleName, cases: LintCase[]): Promise<PluginDiagnostic[][]> {
	if (!existsSync(pluginEntry)) {
		throw new Error(`Нет ${pluginEntry}: перед тестами нужна сборка плагина (bun run build)`);
	}

	const dir = await mkdtemp(join(tmpdir(), "oxlint-plugin-jsdoc-"));
	try {
		const files = await Promise.all(
			cases.map(async (testCase, index) => {
				const extension = testCase.filename?.endsWith(".ts") ? "ts" : "js";
				const path = join(dir, "cases", `case-${index}.${extension}`);
				await mkdir(join(dir, "cases"), { recursive: true });
				await writeFile(path, testCase.code);
				return path;
			}),
		);
		const configPath = join(dir, "oxlintrc.json");
		await writeFile(
			configPath,
			JSON.stringify({
				jsPlugins: [pluginEntry.replaceAll("\\", "/")],
				categories: { correctness: "off" },
				rules: { [`cdd/${rule}`]: "error" },
			}),
		);

		const proc = Bun.spawn(["bun", "x", "oxlint", "-c", configPath, "--format", "json", ...files], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stdout, stderr] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		let output: OxlintOutput;
		try {
			output = JSON.parse(stdout) as OxlintOutput;
		} catch {
			throw new Error(`oxlint вернул не JSON.\nstdout: ${stdout}\nstderr: ${stderr}`);
		}

		// Любая диагностика не от правила (ошибка разбора, падение плагина) — это сбой теста,
		// иначе `valid`-кейсы проходили бы с пустым списком диагностик.
		const unexpected = output.diagnostics.filter((d) => d.code !== `cdd(${rule})`);
		if (unexpected.length > 0) {
			const details = unexpected
				.map((d) => `${d.filename ? basename(d.filename) : "?"}: ${d.message}`)
				.join("\n");
			throw new Error(`oxlint сообщил не о правиле cdd/${rule}:\n${details}`);
		}

		return files.map((file) =>
			output.diagnostics
				.filter((d) => resolve(d.filename) === resolve(file))
				.map((d) => ({
					message: d.message,
					line: d.labels[0]!.span.line,
					column: d.labels[0]!.span.column,
				}))
				.sort((a, b) => a.line - b.line || a.column - b.column)
				.map(({ message, line }) => ({ message, line })),
		);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}
