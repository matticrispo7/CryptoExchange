APP_VERS := $(shell node ./package.js version)
APP_NAME := $(shell node ./package.js name)
APP_PACK := $(APP_NAME)-$(APP_VERS).tgz

all: init build

init:
	npm install

lint:
	npm run lint

build: $(APP_PACK)

$(APP_PACK):
	npm pack

clean:
	$(RM) *.tgz

clean-all: clean
	$(RM) -r ./node_modules

.PHONY: all init lint build clean clean-all
