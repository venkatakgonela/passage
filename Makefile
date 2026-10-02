PYTHON ?= python3
NODE ?= node
export PYTHONPYCACHEPREFIX := $(CURDIR)/.state/pycache

.PHONY: run test lint test-browser
run:
	$(PYTHON) -m server $(ARGS)

test:
	$(PYTHON) -m unittest discover -s tests -p 'test_*.py' -v
	$(NODE) --test tests/*.test.js

lint:
	$(PYTHON) -m compileall -q server tests
	@for file in web/*.js tests/*.test.js; do $(NODE) --check "$$file" || exit 1; done

test-browser:
	$(NODE) tests/browser.mjs
