// Импортировать до ../src: планировщик создаёт MessageChannel при загрузке модуля.
export const schedulerErrors: unknown[] = [];

const NativeMessageChannel = globalThis.MessageChannel;

class CapturingMessageChannel extends NativeMessageChannel {
	constructor() {
		super();
		const port = this.port1;
		let handler: ((event: MessageEvent) => void) | null = null;
		port.onmessage = (event) => {
			try {
				handler?.(event);
			} catch (error) {
				schedulerErrors.push(error);
			}
		};
		Object.defineProperty(port, "onmessage", {
			configurable: true,
			get: () => handler,
			set: (next: ((event: MessageEvent) => void) | null) => {
				handler = next;
			},
		});
	}
}

globalThis.MessageChannel = CapturingMessageChannel;
