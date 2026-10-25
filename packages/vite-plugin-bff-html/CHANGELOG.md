# Changelog

## [0.2.1](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/vite-plugin-bff-html-v0.2.0...vite-plugin-bff-html-v0.2.1) (2026-10-25)


### Bug Fixes

* vite-plugin-bff-html не переносит TE, Trailer и заголовки из Connection ([3efd115](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/3efd115d0923f7d04e37651e75df0d814f43a0c9))
* vite-plugin-bff-html не переносит заголовки соединения BFF — в HTTP/2 Vite на них падал ([92e4a56](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/92e4a5602bdcd4c6cc54ff47aefb5c9b940eac37))
* vite-plugin-bff-html отдаёт редирект BFF браузеру как есть, без перехода внутри плагина ([ec65469](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/ec65469f5a423cce14e604b21623a2463b633277))

## [0.2.0](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/vite-plugin-bff-html-v0.1.0...vite-plugin-bff-html-v0.2.0) (2026-10-24)


### Features

* пакет @cdd-team/vite-plugin-bff-html — HTML страниц от BFF в dev-сервере Vite ([566a9e2](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/566a9e212f50a29b24a2bba742ce8b185d9db3cd))


### Bug Fixes

* vite-plugin-bff-html пропускает пути server.proxy и не трогает ответ BFF не в HTML ([28db7d6](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/28db7d65c85d01b429a2cf4c64d7ddaed0933ed1))
