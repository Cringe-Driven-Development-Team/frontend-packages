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
