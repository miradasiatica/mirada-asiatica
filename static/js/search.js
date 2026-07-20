'use strict';

(function (document, window) {
	var form = document.querySelector('.widget-search__form');
	var input = document.querySelector('.widget-search__field');

	if (!form || !input) {
		return;
	}

	var resultsPanel = document.createElement('div');
	resultsPanel.className = 'widget-search__results';
	resultsPanel.hidden = true;
	form.insertAdjacentElement('afterend', resultsPanel);

	var fuseLoadPromise = null;
	var fuse = null;

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function stripAccents(str) {
		var normalized = String(str).normalize('NFD');
		var result = '';

		for (var i = 0; i < normalized.length; i++) {
			var code = normalized.charCodeAt(i);

			if (code < 0x0300 || code > 0x036f) {
				result += normalized[i];
			}
		}

		return result;
	}

	function toQuery(str) {
		return stripAccents(str.toLowerCase())
			.split(' ')
			.filter(Boolean)
			.map(function (token) { return '\'' + token; })
			.join(' ');
	}

	function loadScript(src) {
		return new Promise(function (resolve, reject) {
			var script = document.createElement('script');
			script.src = src;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	function ensureFuse() {
		if (fuseLoadPromise) {
			return fuseLoadPromise;
		}

		fuseLoadPromise = loadScript('/js/fuse.min.js')
			.then(function () {
				return fetch('/search-index.json');
			})
			.then(function (res) {
				return res.json();
			})
			.then(function (data) {
				data.forEach(function (item) {
					item._title = stripAccents(item.title.toLowerCase());
					item._excerpt = stripAccents(item.excerpt.toLowerCase());
					item._categories = (item.categories || []).map(function (c) { return stripAccents(c.toLowerCase()); });
					item._tags = (item.tags || []).map(function (t) { return stripAccents(t.toLowerCase()); });
				});

				fuse = new window.Fuse(data, {
					includeScore: true,
					ignoreLocation: true,
					useExtendedSearch: true,
					threshold: 0.3,
					keys: [
						{ name: '_title', weight: 0.5 },
						{ name: '_excerpt', weight: 0.2 },
						{ name: '_categories', weight: 0.15 },
						{ name: '_tags', weight: 0.15 }
					]
				});
			});

		return fuseLoadPromise;
	}

	function renderResults(results) {
		if (!results.length) {
			resultsPanel.innerHTML = '<p class="widget-search__empty">Sin resultados</p>';
			resultsPanel.hidden = false;
			return;
		}

		resultsPanel.innerHTML = results.slice(0, 8).map(function (result) {
			var item = result.item;
			var meta = item.categories && item.categories.length ? item.categories.join(', ') : '';

			return '<a class="widget-search__result" href="' + escapeHtml(item.url) + '">' +
				'<span class="widget-search__result-title">' + escapeHtml(item.title) + '</span>' +
				(meta ? '<span class="widget-search__result-meta">' + escapeHtml(meta) + '</span>' : '') +
				'</a>';
		}).join('');

		resultsPanel.hidden = false;
	}

	function runSearch() {
		var query = input.value.trim();

		if (!query) {
			resultsPanel.hidden = true;
			return;
		}

		ensureFuse().then(function () {
			var results = fuse.search(toQuery(query)).filter(function (r) {
				return r.score === undefined || r.score <= 0.4;
			});
			renderResults(results);
		});
	}

	input.addEventListener('focus', function () {
		ensureFuse();
	}, { once: false });

	input.addEventListener('input', runSearch);

	form.addEventListener('submit', function (e) {
		e.preventDefault();
		runSearch();
	});

	document.addEventListener('click', function (e) {
		if (!form.contains(e.target) && !resultsPanel.contains(e.target)) {
			resultsPanel.hidden = true;
		}
	});

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') {
			resultsPanel.hidden = true;
		}
	});
}(document, window));
