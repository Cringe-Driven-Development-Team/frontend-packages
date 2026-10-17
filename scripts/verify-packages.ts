import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

const repoUrl = "git+https://github.com/Cringe-Driven-Development-Team/frontend-packages.git";
const dependencyBlocks = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
] as const;
const oldScopes = ["@maninthecoat", "@iredtea"];

export type PackageName = "react" | "zustand" | "openapi";
export const packageNames: PackageName[] = ["react", "zustand", "openapi"];

type Manifest = Record<string, unknown>;

export function checkManifest(
	pkg: Manifest,
	expected: { name: string; directory: string },
): string[] {
	const violations: string[] = [];

	if (pkg.name !== expected.name) {
		violations.push(`name: ожидалось ${expected.name}, получено ${String(pkg.name)}`);
	}

	const repository = pkg.repository as { url?: string; directory?: string } | undefined;
	if (
		typeof repository !== "object" ||
		repository?.url !== repoUrl ||
		repository.directory !== expected.directory
	) {
		violations.push(`repository: ожидалось { url: ${repoUrl}, directory: ${expected.directory} }`);
	}

	if ((pkg.publishConfig as { access?: string } | undefined)?.access !== "public") {
		violations.push("publishConfig.access должен быть public");
	}

	for (const block of dependencyBlocks) {
		const deps = (pkg[block] ?? {}) as Record<string, string>;
		for (const [dep, range] of Object.entries(deps)) {
			if (range.startsWith("workspace:")) {
				violations.push(`${block}.${dep}: workspace:-диапазон ${range} попал в архив`);
			}
			if (oldScopes.some((scope) => dep.startsWith(`${scope}/`))) {
				violations.push(`${block}.${dep}: ссылка на личный скоуп`);
			}
		}
	}

	return violations;
}

async function run(cmd: string[], cwd: string): Promise<string> {
	const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (code !== 0) {
		throw new Error(`${cmd.join(" ")} (в ${cwd}) завершилась кодом ${code}\n${stdout}\n${stderr}`);
	}
	return stdout;
}

export async function packAll(outDir: string): Promise<Record<PackageName, string>> {
	const root = resolve(import.meta.dir, "..");
	await mkdir(outDir, { recursive: true });
	const archives = {} as Record<PackageName, string>;
	for (const name of packageNames) {
		const output = await run(
			["npm", "pack", "--pack-destination", outDir, "--json"],
			join(root, "packages", name),
		);
		const [info] = JSON.parse(output) as Array<{ filename: string }>;
		archives[name] = join(outDir, info!.filename);
	}
	return archives;
}

function exportTargets(exportsField: unknown): string[] {
	if (typeof exportsField === "string") return [exportsField];
	if (exportsField && typeof exportsField === "object") {
		return Object.values(exportsField).flatMap(exportTargets);
	}
	return [];
}

async function exists(path: string): Promise<boolean> {
	return stat(path).then(
		() => true,
		() => false,
	);
}

async function inspectArchive(
	name: PackageName,
	archive: string,
	workDir: string,
): Promise<string[]> {
	const target = join(workDir, `unpacked-${name}`);
	await mkdir(target, { recursive: true });
	// Относительные пути: GNU tar принимает «C:» за имя хоста.
	const archiveDir = dirname(archive);
	await run(["tar", "-xzf", basename(archive), "-C", relative(archiveDir, target)], archiveDir);
	const root = join(target, "package");
	const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Manifest;

	const violations = checkManifest(pkg, {
		name: `@cdd-team/${name}`,
		directory: `packages/${name}`,
	}).map((v) => `${name}: ${v}`);

	for (const file of exportTargets(pkg.exports)) {
		if (!(await exists(join(root, file)))) {
			violations.push(`${name}: exports указывает на отсутствующий в архиве файл ${file}`);
		}
	}

	if (name === "zustand") {
		const entry = await readFile(join(root, "dist/index.mjs"), "utf8");
		if (!entry.includes('"@cdd-team/react"')) {
			violations.push(
				"zustand: dist/index.mjs не импортирует @cdd-team/react (React мог быть вшит)",
			);
		}
	}

	return violations;
}

async function scenario(
	name: string,
	fixture: string,
	archives: string[],
	workDir: string,
	checks: string[][],
	expectedVersions: Record<string, string>,
): Promise<void> {
	const dir = join(workDir, `scenario-${name}`);
	await cp(join(import.meta.dir, "fixtures", fixture), dir, { recursive: true });
	for (const file of await readdir(dir)) {
		if (file.endsWith(".check.ts") || file.endsWith(".check.tsx")) {
			await cp(join(dir, file), join(dir, file.replace(".check.", ".test.")));
		}
	}
	// Все локальные архивы ставятся одной командой: registry не должен подтянуть React сам.
	await run(["bun", "add", ...archives], dir);
	for (const [pkg, expectedVersion] of Object.entries(expectedVersions)) {
		const installed = JSON.parse(
			await readFile(join(dir, "node_modules", "@cdd-team", pkg, "package.json"), "utf8"),
		);
		if (installed.version !== expectedVersion) {
			throw new Error(
				`${name}: установлен @cdd-team/${pkg}@${installed.version}, ожидался локальный архив ${expectedVersion}`,
			);
		}
	}
	for (const check of checks) await run(check, dir);
}

async function localVersion(root: string, name: PackageName): Promise<string> {
	return JSON.parse(await readFile(join(root, "packages", name, "package.json"), "utf8")).version;
}

export async function verify(): Promise<void> {
	const root = resolve(import.meta.dir, "..");
	const workDir = await mkdtemp(join(tmpdir(), "cdd-verify-"));
	try {
		await run(["bun", "run", "build"], root);
		const archives = await packAll(join(workDir, "archives"));

		const violations: string[] = [];
		for (const name of packageNames) {
			violations.push(...(await inspectArchive(name, archives[name], workDir)));
		}
		if (violations.length > 0)
			throw new Error(`Нарушения в архивах:\n- ${violations.join("\n- ")}`);

		const versions = {
			react: await localVersion(root, "react"),
			zustand: await localVersion(root, "zustand"),
		};
		await scenario(
			"consumer",
			"consumer",
			[archives.react, archives.zustand],
			workDir,
			[
				["bun", "x", "tsc", "--noEmit"],
				["bun", "build", "main.tsx", "--outdir", "out", "--target", "browser"],
				["bun", "test", "--preload", "./setup-dom.ts"],
			],
			versions,
		);

		await scenario(
			"vanilla",
			"vanilla",
			[archives.zustand],
			workDir,
			[
				["bun", "x", "tsc", "--noEmit"],
				["bun", "test"],
			],
			{ zustand: versions.zustand },
		);
		const vanillaModules = join(workDir, "scenario-vanilla", "node_modules", "@cdd-team");
		if (await exists(join(vanillaModules, "react"))) {
			throw new Error("vanilla-сценарий: @cdd-team/react установился, хотя это optional peer");
		}

		console.log("OK: архивы react, zustand, openapi и сценарии consumer/vanilla прошли проверку");
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	verify().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
