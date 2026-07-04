install:
	npm install
	cd task1-upload-queue && npm install
	cd task2-file-list && npm install
	cd task3-chunk-upload && npm install

run1:
	cd task1-upload-queue && npm run dev

run2:
	cd task2-file-list && npm run dev

run3:
	cd task3-chunk-upload && npm run dev

build:
	cd task1-upload-queue && npm run build
	cd task2-file-list && npm run build
	cd task3-chunk-upload && npm run build

test:
	npm run test:e2e
