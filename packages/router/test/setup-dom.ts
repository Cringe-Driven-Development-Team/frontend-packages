import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Браузерной истории нужен настоящий адрес: у about:blank pushState не меняет путь
GlobalRegistrator.register({ url: "http://localhost/" });
