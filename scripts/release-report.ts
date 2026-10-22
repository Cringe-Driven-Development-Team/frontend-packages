// Отчёт публикации: publish-released.ts пишет его, release-notify.ts собирает по нему карточку.
export type PublishStatus = "published" | "skipped" | "unconfirmed" | "failed" | "not-attempted";

export type ErrorKind = "auth" | "conflict" | "network" | "unknown";

export type PackageResult = {
	path: string;
	name: string;
	version: string;
	status: PublishStatus;
	reason?: string;
	errorKind?: ErrorKind;
};

// Каждая попытка запуска выгружает свой отчёт: перезапуск после публикации видит версии уже в npm и
// пишет skipped. Для пакета берём последний статус, отличный от skipped, чтобы публикация не потерялась.
export function mergeReports(reports: PackageResult[][]): PackageResult[] {
	const merged = new Map<string, PackageResult>();
	for (const entry of reports.flat()) {
		const current = merged.get(entry.path);
		if (!current || entry.status !== "skipped" || current.status === "skipped") {
			merged.set(entry.path, entry);
		}
	}
	return [...merged.values()];
}

// Артефакт отчёта называется release-report-<номер попытки>, download-artifact кладёт его в одноимённый каталог.
export function reportAttempt(file: string): number | null {
	const match = /release-report-(\d+)\//.exec(file.replaceAll("\\", "/"));
	return match ? Number(match[1]) : null;
}

export async function readReport(file: string): Promise<PackageResult[] | null> {
	const source = Bun.file(file);
	if (!(await source.exists())) return null;
	try {
		const data: unknown = JSON.parse(await source.text());
		return Array.isArray(data) ? (data as PackageResult[]) : null;
	} catch {
		return null;
	}
}
