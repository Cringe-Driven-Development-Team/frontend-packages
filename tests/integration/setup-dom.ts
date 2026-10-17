import { GlobalRegistrator } from "@happy-dom/global-registrator";

// tsdown подставляет __PROFILE__ при сборке; в тестах из исходников её нужно задать самим.
(globalThis as { __PROFILE__?: boolean }).__PROFILE__ = false;

GlobalRegistrator.register();
