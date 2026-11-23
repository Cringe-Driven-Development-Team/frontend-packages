# Changelog

## [0.1.1](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/vite-plugin-mkcert-v0.1.0...vite-plugin-mkcert-v0.1.1) (2026-11-23)


### Features

* vite-plugin-mkcert выбирает рабочий mkcert и скачивает проверенный ([ccc1273](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/ccc1273091ab601e6738db6d487a4bb34471f10e))
* vite-plugin-mkcert задаёт server.https dev-сервера ([4fd91b9](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/4fd91b92ad94bc4b8c80629db4d2d340581ff02a))
* vite-plugin-mkcert перевыпускает сертификат только при смене hosts или CA ([e87e48b](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/e87e48b2b8b4db4bec27f4762823859b82ae520f))


### Bug Fixes

* vite-plugin-mkcert сравнивает IPv6 из hosts с развёрнутой записью SAN ([8bb3df4](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/8bb3df42d4a9dfcffd7fda929a4d9e082d6650b2))
* кэш сертификата проверяет, что key.pem от того же выпуска ([e5c7056](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/e5c7056f8a8291e4a18e631c94e855cb26a8150c))
* срок сертификата через validTo — validToDate нет в Node 20 ([4cbfc6c](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/4cbfc6c3b122f4757c17707085a7e6328276576c))


### Documentation

* описать выпуск @cdd-team/vite-plugin-mkcert ([e86c6d9](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/e86c6d98c228766919cd03653d31b87cbd24074f))
