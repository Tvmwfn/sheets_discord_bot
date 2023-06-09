APPLICATION_NAME ?= discord-bot

build:
	docker build --tag ${APPLICATION_NAME} .
