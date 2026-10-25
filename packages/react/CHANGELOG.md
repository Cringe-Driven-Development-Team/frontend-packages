# Changelog

## [1.6.0](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/react-v1.5.0...react-v1.6.0) (2026-10-25)


### Features

* useSyncExternalStoreWithSelector в @cdd-team/react ([43065f0](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/43065f0ca941b8fd950674de3efa82e775f7f7ff))


### Bug Fixes

* useSyncExternalStore не бросает из layout effect при ошибке повторного чтения snapshot ([4b1896a](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/4b1896a568df419930ec7ea5fae5bc4e6a72e69b))

## [1.5.0](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/react-v1.4.0...react-v1.5.0) (2026-10-22)


### Features

* createPortal и типы портала в @cdd-team/react ([9b1d4ca](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/9b1d4cadc2eb5bb18fe15a3099bfd2be13224e7d))
* монтирование и обновление порталов в @cdd-team/react ([6715e4b](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/6715e4b92a743c26162df73c2ee4e65a232234ab))
* перестановка порталов с общим контейнером в @cdd-team/react ([d6720c1](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/d6720c186e5c7b1e0cbb1868dd1c6c9e923f7395))
* пример порталов в playground @cdd-team/react ([28a360a](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/28a360a2400da508ba62db4738c5c6498d50b3b0))
* удаление порталов и смена их контейнера в @cdd-team/react ([be428f8](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/be428f8916f3c269632d372b781dbf9bfe3d3a05))


### Bug Fixes

* новый ребёнок портала встаёт перед следующим порталом в общем контейнере ([d6c72d4](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/d6c72d4d2abd2f55c4ba79bb54c1468c1c6aa493))
* якорь перестановки портала не берётся из вставляемого поддерева ([df79fd2](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/df79fd2cef4e05822f8ff3fec1d3cca7781c000c))

## [1.4.0](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/react-v1.3.0...react-v1.4.0) (2026-10-21)


### Features

* ограничить перезапуски из-за некэшированного getSnapshot ([9dd3ba6](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/9dd3ba68094d113b38cfde8c0d9cd88ebcb8df2e))
* отменять commit с устаревшим снимком внешнего стора ([bb991fd](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/bb991fd477a0a99b52ece7833cfc26dabb01b9a2))
* пример внешнего стора в playground @cdd-team/react ([f5a1700](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/f5a17009df9851098e1c72f83df5acbdde6820fc))
* считать в пределе только перезапуски с некэшированным getSnapshot ([9d2875e](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/9d2875e619c6f417940da073de3e2fe109c35b5c))
* считать ошибку getSnapshot в слушателе изменением снимка ([16c378c](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/16c378c8ae48b03a475ef692f8021932dc96b8bd))
* считать ошибку getSnapshot перед commit устаревшим снимком ([65c83c9](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/65c83c9da6ff50d27761535ebd07a73c5beae1fe))
* хук useSyncExternalStore в @cdd-team/react ([3ecc78a](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/3ecc78afb8afa8d927c45321bc258520967b4b47))

## [1.3.0](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/react-v1.2.1...react-v1.3.0) (2026-10-19)


### Features

* пример refs в playground @cdd-team/react ([6fa3b15](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/6fa3b15c9f59f21cb6bb1f31bde9981aa55ad9b4))
* проп ref у DOM-элементов в @cdd-team/react ([013e007](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/013e007e5cb03a6eb2c6d23fecc76b03d1d72d7e))
* хук useImperativeHandle в @cdd-team/react ([3ca2321](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/3ca2321e6dced15c9bf1b6b9023a059da25ec608))
* хук useRef в @cdd-team/react ([46da710](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/46da71080a0468e5e1511d6eafd00f8978f37ab4))

## [1.2.1](https://github.com/Cringe-Driven-Development-Team/frontend-packages/compare/react-v1.2.0...react-v1.2.1) (2026-10-17)


### Bug Fixes

* README пакета react — установка и минимальный пример ([a7f63a9](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/a7f63a93ee478494cf85ed6f9182ae2baf0667c5))
* README пакетов react и openapi (первый автоматический выпуск) ([6bee3cc](https://github.com/Cringe-Driven-Development-Team/frontend-packages/commit/6bee3ccefd6e598b275aca871fd1b1192a083b21))
