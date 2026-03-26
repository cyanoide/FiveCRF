document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // DOM
    // =============================================
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-view');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.toggle-sidebar-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;

    let playerChart = null;
    let currentSeason = { replay: 'all', joueurs: '2026' };
    let currentSort = 'goals';
    let selectedPlayer = null;

    // =============================================
    // NAME MATCHING — safe fuzzy match between
    // history names and replay names.
    // Rules: exact OR single-word-to-any (e.g. "Loic" ↔ "Loic Laguerre").
    // Multi-word names require exact match to avoid
    // confusing "Abdel Karim" with "Abdel Rafik".
    // =============================================
    function nameMatches(a, b) {
        const aL = a.toLowerCase().trim();
        const bL = b.toLowerCase().trim();
        if (aL === bL) return true;
        const aParts = aL.split(' ');
        const bParts = bL.split(' ');
        // Allow prefix only when one side is a single word
        if (aParts.length === 1 && bParts[0] === aParts[0]) return true;
        if (bParts.length === 1 && aParts[0] === bParts[0]) return true;
        return false;
    }

    // =============================================
    // BUILD DATE -> YEAR MAP (from replays_data.js)
    // =============================================
    const dateYearMap = {};
    if (window.replays) {
        window.replays.forEach(m => {
            const parts = m.date.split('/');
            const shortDate = `${parts[0]}/${parts[1]}`;
            dateYearMap[shortDate] = parts[2];
        });
    }

    function dateToYear(shortDate) {
        return dateYearMap[shortDate] || null;
    }

    // =============================================
    // THEME TOGGLE
    // =============================================
    const savedTheme = localStorage.getItem('five-theme') || 'light';
    applyTheme(savedTheme);

    themeToggle?.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    });

    function applyTheme(theme) {
        html.setAttribute('data-theme', theme);
        localStorage.setItem('five-theme', theme);
        const icon = themeToggle?.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        if (playerChart) updateChartColors();
    }

    // =============================================
    // NAVIGATION
    // =============================================
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target)?.classList.add('active');

            if (window.innerWidth <= 768) sidebar.classList.remove('open');
            if (target === 'joueurs') buildJoueursList();
            if (target === 'confrontations') initConfrontations();
            if (target === 'stats') buildStatsPage();
        });
    });

    sidebarToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    // =============================================
    // SEASON SELECTORS
    // =============================================
    document.getElementById('replay-season-selector')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.season-btn');
        if (!btn) return;
        e.currentTarget.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSeason.replay = btn.dataset.year;
        buildReplayList();
    });

    document.getElementById('joueurs-season-selector')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.season-btn');
        if (!btn) return;
        e.currentTarget.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSeason.joueurs = btn.dataset.year;
        selectedPlayer = null;
        buildJoueursList();
        resetDetailPanel();
    });

    // Set default active on joueurs season selector to 2026
    (function setDefaultJoueursSeason() {
        const sel = document.getElementById('joueurs-season-selector');
        if (!sel) return;
        sel.querySelectorAll('.season-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.year === '2026');
        });
    })();

    // =============================================
    // SORT CONTROLS
    // =============================================
    document.getElementById('sort-controls')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sort-btn');
        if (!btn) return;
        e.currentTarget.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        buildJoueursList();
    });

    // =============================================
    // HELPERS
    // =============================================
    function getYear(dateStr) {
        return dateStr.split('/').pop();
    }

    function filterReplaysByYear(year) {
        if (!window.replays) return [];
        if (year === 'all') return window.replays;
        return window.replays.filter(m => getYear(m.date) === year);
    }

    function parseDate(dateStr) {
        const p = dateStr.split('/');
        return new Date(p[2], p[1] - 1, p[0]);
    }

    const IMG_MAP = {
        'Abdel Karim': 'abdel_karim.png',
        'Abdel Rafik': 'abdel_rafik.png',
        'Anasse': 'anasse.png',
        'Christian': 'christian.png',
        'Constantin': 'constantin.png',
        'Dorian': 'dorian.png',
        'Enos': 'enos.png',
        'Jesus': 'jesus.png',
        'Luka': 'luka.png',
        'Mahamat': 'mahamat.png',
        'Nabil': 'nabil.png',
        'Sidoine': 'sidoine.png'
    };

    function playerImg(name) {
        const file = IMG_MAP[name];
        if (file) return `joueurs/${file}`;
        return fallbackImg(name);
    }

    function fallbackImg(name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1c2a4a&color=868e96&size=120&bold=true&font-size=0.4`;
    }

    function resetDetailPanel() {
        const panel = document.getElementById('joueur-detail');
        if (panel) {
            panel.innerHTML = `
                <div class="joueur-detail-empty">
                    <i class="fa-solid fa-shirt"></i>
                    <span>Selectionne un joueur</span>
                </div>`;
        }
        if (playerChart) { playerChart.destroy(); playerChart = null; }
    }

    // =============================================
    // NAVIGATION DEPUIS UN REPLAY → FICHE JOUEUR
    // =============================================
    function navigateToPlayer(playerName) {
        const historyName = Object.keys(window.playerHistory || {}).find(k => nameMatches(k, playerName));
        if (!historyName) return;

        // Basculer sur l'onglet Joueurs
        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        document.querySelector('[data-target="joueurs"]')?.classList.add('active');
        document.getElementById('joueurs')?.classList.add('active');
        if (window.innerWidth <= 768) sidebar.classList.remove('open');

        // Forcer la saison "Tout" pour être sûr d'avoir des données
        currentSeason.joueurs = 'all';
        document.querySelectorAll('#joueurs-season-selector .season-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.year === 'all');
        });

        // Sélectionner le joueur et afficher sa fiche
        selectedPlayer = historyName;
        buildJoueursList();
        showJoueurDetail(historyName);

        // Scroll vers la fiche sur mobile
        setTimeout(() => {
            document.getElementById('joueur-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // =============================================
    // NAVIGATION DEPUIS UNE DATE → REPLAY
    // =============================================
    function navigateToReplay(shortDate) {
        const year = dateToYear(shortDate);
        if (!year) return;
        const fullDate = `${shortDate}/${year}`;

        // Basculer sur l'onglet Replays
        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        document.querySelector('[data-target="replay"]')?.classList.add('active');
        document.getElementById('replay')?.classList.add('active');
        if (window.innerWidth <= 768) sidebar.classList.remove('open');

        // Ne reconstruire que si l'item n'est pas dans le DOM actuel
        // (filtre saison incompatible). Évite le flash blanc causé par innerHTML = ''.
        const alreadyInDom = document.querySelector(`.replay-item[data-date="${fullDate}"]`);
        if (!alreadyInDom) {
            currentSeason.replay = 'all';
            document.querySelectorAll('#replay-season-selector .season-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.year === 'all');
            });
            buildReplayList();
        }

        // Ouvrir et scroller après le prochain cycle de rendu
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const item = document.querySelector(`.replay-item[data-date="${fullDate}"]`);
            if (item) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }));
    }

    // =============================================
    // REPLAYS
    // =============================================
    function buildReplayList() {
        const container = document.getElementById('replay-list');
        if (!container || !window.replays) return;
        container.innerHTML = '';

        let matches = filterReplaysByYear(currentSeason.replay);
        matches.sort((a, b) => parseDate(b.date) - parseDate(a.date));

        if (matches.length === 0) {
            container.innerHTML = '<div class="no-data">Aucun replay pour cette saison.</div>';
            return;
        }

        matches.forEach(match => {
            const item = document.createElement('div');
            item.className = 'replay-item';
            item.dataset.date = match.date;

            const scoreA = parseInt(match.scoreA);
            const scoreB = parseInt(match.scoreB);
            let classA = 'draw', classB = 'draw';
            if (scoreA > scoreB) { classA = 'winner'; classB = 'loser'; }
            else if (scoreB > scoreA) { classA = 'loser'; classB = 'winner'; }

            const dateParts = match.date.split('/');
            const dateDisplay = `${dateParts[0]}/${dateParts[1]}`;
            const yearDisplay = dateParts[2];

            const formatPlayers = (list) =>
                (list || []).map(p => {
                    const hasHistory = Object.keys(window.playerHistory || {}).some(k => nameMatches(k, p));
                    return hasHistory
                        ? `<div class="player-line player-link" data-player="${p}">${p}</div>`
                        : `<div class="player-line">${p}</div>`;
                }).join('');

            // Visual timeline
            let visualHtml = '';
            if (match.timeline?.length > 0) {
                visualHtml = '<div class="visual-timeline"><div class="timeline-line"></div>';
                const isDraw = scoreA === scoreB;
                match.timeline.forEach(ev => {
                    const min = parseInt(ev.minute);
                    const left = Math.min((min / 60) * 100, 100);
                    const scorer = ev.scorer.trim().toLowerCase();
                    const isTeamA = (match.teamA || []).some(p =>
                        p.toLowerCase().includes(scorer) ||
                        scorer.includes(p.toLowerCase().split(' ')[0])
                    );
                    const pos = isTeamA ? 'top' : 'bottom';
                    // Colour: green = scoring team won, red = scoring team lost, grey = draw
                    let resultClass;
                    if (isDraw) {
                        resultClass = 'draw-goal';
                    } else {
                        const teamWon = isTeamA ? (scoreA > scoreB) : (scoreB > scoreA);
                        resultClass = teamWon ? 'win-goal' : 'lose-goal';
                    }
                    visualHtml += `
                        <div class="goal-marker ${pos} ${resultClass}" style="left:${left}%">
                            <div class="marker-line"></div>
                            <i class="fa-regular fa-futbol"></i>
                            <div class="marker-tooltip">${ev.minute}' ${ev.scorer}<span class="tooltip-score">${ev.score}</span></div>
                        </div>`;
                });
                visualHtml += '<div class="time-label start">0\'</div><div class="time-label end">60\'</div></div>';
            }

            // Text timeline
            let textHtml = '<div class="timeline-events">';
            if (match.timeline?.length > 0) {
                match.timeline.forEach(ev => {
                    textHtml += `
                        <div class="timeline-event">
                            <span class="event-time">${ev.minute}'</span>
                            <span class="event-scorer">${ev.scorer}</span>
                            <span class="event-score">${ev.score}</span>
                        </div>`;
                });
            } else {
                textHtml += '<div class="no-events">Aucun detail</div>';
            }
            textHtml += '</div>';

            item.innerHTML = `
                <div class="replay-header">
                    <span class="replay-date">
                        <span class="date-day">${dateDisplay}</span>
                        <span class="date-year">${yearDisplay}</span>
                    </span>
                    <div class="replay-score-block">
                        <span class="replay-score-badge">${match.scoreA} - ${match.scoreB}</span>
                    </div>
                    <span class="toggle-icon"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
                <div class="replay-details">
                    <div class="replay-details-inner">
                        <div class="match-info">
                            <div class="team-block ${classA}">
                                <div class="team-label">Equipe A</div>
                                <div class="team-players">${formatPlayers(match.teamA)}</div>
                                <div class="team-score">${match.scoreA}</div>
                            </div>
                            <div class="vs-divider">VS</div>
                            <div class="team-block ${classB}">
                                <div class="team-label">Equipe B</div>
                                <div class="team-players">${formatPlayers(match.teamB)}</div>
                                <div class="team-score">${match.scoreB}</div>
                            </div>
                        </div>
                        <div class="timeline-section">
                            <div class="timeline-section-header" data-expanded="false">
                                <span>Fil du match</span>
                                <i class="fa-solid fa-chevron-down"></i>
                            </div>
                            ${visualHtml}
                            <div class="timeline-text-wrapper collapsed">
                                ${textHtml}
                            </div>
                        </div>
                        ${match.link ? `<a href="${match.link}" target="_blank" class="replay-link-btn"><i class="fa-solid fa-play"></i> Voir le Replay</a>` : ''}
                    </div>
                </div>`;

            // Toggle card open/close
            item.querySelector('.replay-header').addEventListener('click', () => {
                item.classList.toggle('active');
            });

            // Toggle timeline text (fil du match)
            const tlHeader = item.querySelector('.timeline-section-header');
            const tlWrapper = item.querySelector('.timeline-text-wrapper');
            if (tlHeader && tlWrapper) {
                tlHeader.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const expanded = tlHeader.dataset.expanded === 'true';
                    tlHeader.dataset.expanded = expanded ? 'false' : 'true';
                    tlWrapper.classList.toggle('collapsed');
                    tlHeader.querySelector('i').classList.toggle('rotate');
                });
            }

            // Liens joueurs → fiche
            item.querySelectorAll('.player-link').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigateToPlayer(el.dataset.player);
                });
            });

            container.appendChild(item);
        });
    }

    // =============================================
    // JOUEURS — Stats UNIQUEMENT depuis history_data.js
    // Le mapping date (dd/mm) -> annee se fait via replays_data.js
    // =============================================
    function computePlayerStats(year) {
        const stats = {};

        if (!window.playerHistory) return stats;

        Object.entries(window.playerHistory).forEach(([name, history]) => {
            // Filter entries by year
            let filtered;
            if (year === 'all') {
                filtered = history;
            } else {
                filtered = history.filter(h => dateToYear(h.date) === year);
            }

            if (filtered.length === 0) return;

            const totalGoals = filtered.reduce((s, h) => s + (h.goals || 0), 0);
            const totalAssists = filtered.reduce((s, h) => s + (h.assists || 0), 0);
            const matches = filtered.length;

            const wins   = filtered.filter(h => getMatchResult(name, h.date) === 'win').length;
            const draws  = filtered.filter(h => getMatchResult(name, h.date) === 'draw').length;
            const losses = filtered.filter(h => getMatchResult(name, h.date) === 'loss').length;
            const formRatio = matches > 0 ? Math.round((wins + draws * 0.5) / matches * 100) : 0;

            stats[name] = {
                matches,
                goals: totalGoals,
                assists: totalAssists,
                ratio: matches > 0 ? totalGoals / matches : 0,
                wins,
                draws,
                losses,
                formRatio
            };
        });

        return stats;
    }

    function getFilteredHistory(name, year) {
        if (!window.playerHistory?.[name]) return [];
        const history = window.playerHistory[name];
        if (year === 'all') return history;
        return history.filter(h => dateToYear(h.date) === year);
    }

    // =============================================
    // MATCH RESULT — croisement history x replays
    // =============================================
    function getMatchResult(name, shortDate) {
        if (!window.replays) return null;
        const year = dateToYear(shortDate);
        if (!year) return null;
        const fullDate = `${shortDate}/${year}`;
        const match = window.replays.find(m => m.date === fullDate);
        if (!match) return null;

        function inTeam(team) {
            return (team || []).some(p => nameMatches(p, name));
        }
        const inA = inTeam(match.teamA);
        const inB = inTeam(match.teamB);
        if (!inA && !inB) return null;

        const scoreA = parseInt(match.scoreA);
        const scoreB = parseInt(match.scoreB);
        if (scoreA === scoreB) return 'draw';
        return (inA ? scoreA > scoreB : scoreB > scoreA) ? 'win' : 'loss';
    }

    function sortPlayers(entries) {
        switch (currentSort) {
            case 'goals':
                return entries.sort((a, b) => b[1].goals - a[1].goals || b[1].assists - a[1].assists);
            case 'matches':
                return entries.sort((a, b) => b[1].matches - a[1].matches || b[1].goals - a[1].goals);
            case 'ratio':
                return entries.sort((a, b) => b[1].ratio - a[1].ratio || b[1].goals - a[1].goals);
            case 'ga':
                return entries.sort((a, b) =>
                    (b[1].goals + b[1].assists) - (a[1].goals + a[1].assists) || b[1].goals - a[1].goals
                );
            case 'formRatio':
                return entries.sort((a, b) => b[1].formRatio - a[1].formRatio || b[1].wins - a[1].wins);
            default:
                return entries;
        }
    }

    function buildJoueursList() {
        const list = document.getElementById('joueurs-list');
        const countEl = document.getElementById('joueurs-count');
        if (!list) return;

        const stats = computePlayerStats(currentSeason.joueurs);

        let sorted = Object.entries(stats);
        sorted = sortPlayers(sorted);

        if (countEl) countEl.textContent = `${sorted.length} joueurs`;
        list.innerHTML = '';

        if (sorted.length === 0) {
            list.innerHTML = '<div class="no-data" style="padding:20px">Aucune donnee pour cette saison.</div>';
            return;
        }

        const badgeValue = (st) => {
            switch (currentSort) {
                case 'goals':     return `${st.goals}`;
                case 'matches':   return `${st.matches}`;
                case 'ratio':     return st.ratio.toFixed(1);
                case 'ga':        return `${st.goals + st.assists}`;
                case 'formRatio': return `${st.formRatio}%`;
                default:          return `${st.goals}`;
            }
        };

        const badgeIcon = () => {
            switch (currentSort) {
                case 'goals': return '<i class="fa-regular fa-futbol" style="font-size:0.55rem;margin-left:2px;opacity:0.4"></i>';
                case 'ratio': return '<span style="font-size:0.55rem;opacity:0.4;margin-left:1px">/m</span>';
                default: return '';
            }
        };

        sorted.forEach(([name, st], idx) => {
            const row = document.createElement('div');
            row.className = 'joueur-row' + (selectedPlayer === name ? ' active' : '');

            row.innerHTML = `
                <span class="joueur-rank">${idx + 1}</span>
                <img class="joueur-avatar" src="${playerImg(name)}" alt="${name}"
                     onerror="this.src='${fallbackImg(name)}'">
                <span class="joueur-name">${name}</span>
                <span class="joueur-goals-badge">${badgeValue(st)}${badgeIcon()}</span>
                <span class="joueur-matches-badge">${st.matches} m.</span>`;

            row.addEventListener('click', () => {
                selectedPlayer = name;
                list.querySelectorAll('.joueur-row').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                showJoueurDetail(name);
            });

            list.appendChild(row);
        });

        // Refresh detail if still selected
        if (selectedPlayer && stats[selectedPlayer]) {
            showJoueurDetail(selectedPlayer);
        }
    }

    // =============================================
    // JOUEUR DETAIL
    // =============================================
    function showJoueurDetail(name) {
        const panel = document.getElementById('joueur-detail');
        if (!panel) return;

        const year = currentSeason.joueurs;
        const stats = computePlayerStats(year);
        const st = stats[name];
        if (!st) { resetDetailPanel(); return; }

        const history = getFilteredHistory(name, year);

        // Form strip — 5 derniers matchs
        const last5 = history.slice(-5);
        const formDotsHtml = last5.map(h => {
            const r = getMatchResult(name, h.date);
            if (!r) return '';
            const cls  = r === 'win' ? 'win' : r === 'draw' ? 'draw' : 'loss';
            const icon = r === 'win' ? 'fa-check' : r === 'draw' ? 'fa-minus' : 'fa-xmark';
            return `<div class="form-dot ${cls}" title="${h.date}"><i class="fa-solid ${icon}"></i></div>`;
        }).filter(Boolean).join('');

        // Build history rows — most recent first, with V/N/D badge
        let historyRows = '';
        [...history].reverse().forEach(h => {
            const r = getMatchResult(name, h.date);
            const badge = r
                ? `<span class="result-badge ${r === 'win' ? 'win' : r === 'draw' ? 'draw' : 'loss'}">${r === 'win' ? 'V' : r === 'draw' ? 'N' : 'D'}</span>`
                : '<span class="result-badge unknown">—</span>';
            historyRows += `
                <tr>
                    <td class="date-link" data-shortdate="${h.date}">${h.date}</td>
                    <td>${badge}</td>
                    <td class="goals-cell">${h.goals}</td>
                    <td class="assists-cell">${h.assists}</td>
                    <td>${h.goals + h.assists}</td>
                </tr>`;
        });

        const seasonLabel = year !== 'all' ? `Saison ${year}` : 'Toutes saisons';

        panel.innerHTML = `
            <div class="joueur-profile">
                <img class="joueur-profile-img" src="${playerImg(name)}" alt="${name}"
                     onerror="this.src='${fallbackImg(name)}'">
                <div class="joueur-profile-info">
                    <h2>${name}</h2>
                    <div class="joueur-profile-sub">${st.matches} match${st.matches > 1 ? 's' : ''} · ${seasonLabel}</div>
                </div>
            </div>
            ${formDotsHtml ? `
            <div class="form-strip">
                <span class="form-strip-label">Forme</span>
                ${formDotsHtml}
            </div>` : ''}
            <div class="joueur-stats-grid">
                <div class="joueur-stat-card highlight">
                    <span class="val">${st.goals}</span>
                    <span class="lbl">Buts</span>
                </div>
                <div class="joueur-stat-card">
                    <span class="val">${st.assists}</span>
                    <span class="lbl">Passes D.</span>
                </div>
                <div class="joueur-stat-card">
                    <span class="val">${st.goals + st.assists}</span>
                    <span class="lbl">G+A</span>
                </div>
                <div class="joueur-stat-card">
                    <span class="val">${st.ratio.toFixed(1)}</span>
                    <span class="lbl">Buts/Match</span>
                </div>
                <div class="joueur-stat-card result-win">
                    <span class="val">${st.wins}</span>
                    <span class="lbl">Victoires</span>
                </div>
                <div class="joueur-stat-card result-draw">
                    <span class="val">${st.draws}</span>
                    <span class="lbl">Nuls</span>
                </div>
                <div class="joueur-stat-card result-loss">
                    <span class="val">${st.losses}</span>
                    <span class="lbl">Defaites</span>
                </div>
                <div class="joueur-stat-card">
                    <span class="val">${st.formRatio}%</span>
                    <span class="lbl">Ratio V.</span>
                </div>
            </div>
            ${history.length >= 1 ? `
            <div class="joueur-chart-section">
                <h4>Buts par match</h4>
                <div class="canvas-container">
                    <canvas id="joueurChart"></canvas>
                </div>
            </div>` : ''}
            ${historyRows ? `
            <div class="joueur-history">
                <h4>Historique par match</h4>
                <table class="history-table">
                    <thead>
                        <tr><th>Date</th><th></th><th>Buts</th><th>Passes D.</th><th>G+A</th></tr>
                    </thead>
                    <tbody>${historyRows}</tbody>
                </table>
            </div>` : ''}
        `;

        // Listeners date → replay
        panel.querySelectorAll('.date-link').forEach(el => {
            el.addEventListener('click', () => navigateToReplay(el.dataset.shortdate));
        });

        // Build chart after DOM is ready
        if (history.length >= 1) {
            requestAnimationFrame(() => buildPlayerChart(history));
        }
    }

    // =============================================
    // PLAYER CHART — Buts par match (bar chart)
    // =============================================
    function getChartColors() {
        const isDark = html.getAttribute('data-theme') === 'dark';
        return {
            grid: isDark ? 'rgba(44, 62, 90, 0.5)' : 'rgba(0, 0, 0, 0.06)',
            tick: isDark ? '#495057' : '#adb5bd',
            legend: isDark ? '#868e96' : '#6c757d',
            tooltipBg: isDark ? '#0f1729' : '#ffffff',
            tooltipTitle: isDark ? '#e9ecef' : '#212529',
            tooltipBody: isDark ? '#868e96' : '#6c757d',
            tooltipBorder: isDark ? '#2c3e5a' : '#dee2e6',
        };
    }

    function buildPlayerChart(data) {
        const ctx = document.getElementById('joueurChart');
        if (!ctx) return;

        if (playerChart) { playerChart.destroy(); playerChart = null; }

        const c = getChartColors();

        // Canvas gradients for a modern filled-area look
        const canvas = ctx.getContext('2d');
        const h = ctx.clientHeight || 220;
        const gradGoals = canvas.createLinearGradient(0, 0, 0, h);
        gradGoals.addColorStop(0, 'rgba(55, 178, 77, 0.28)');
        gradGoals.addColorStop(0.65, 'rgba(55, 178, 77, 0.05)');
        gradGoals.addColorStop(1, 'rgba(55, 178, 77, 0)');
        const gradAssists = canvas.createLinearGradient(0, 0, 0, h);
        gradAssists.addColorStop(0, 'rgba(51, 154, 240, 0.22)');
        gradAssists.addColorStop(0.65, 'rgba(51, 154, 240, 0.04)');
        gradAssists.addColorStop(1, 'rgba(51, 154, 240, 0)');

        const labels = data.map(d => d.date);
        const goalsData = data.map((d, i) => ({ x: i, y: d.goals }));
        const assistsData = data.map((d, i) => ({ x: i, y: d.assists }));

        playerChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Buts',
                        data: goalsData,
                        borderColor: '#37b24d',
                        backgroundColor: gradGoals,
                        borderWidth: 2,
                        pointBackgroundColor: '#37b24d',
                        pointBorderColor: c.tooltipBg,
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#51cf66',
                        pointHoverBorderColor: '#51cf66',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Passes D.',
                        data: assistsData,
                        borderColor: '#339af0',
                        backgroundColor: gradAssists,
                        borderWidth: 2,
                        pointBackgroundColor: '#339af0',
                        pointBorderColor: c.tooltipBg,
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: c.legend,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 7,
                            boxHeight: 7,
                            padding: 14,
                            font: { family: "'Klapt', 'Barlow Condensed', sans-serif", size: 11, weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: c.tooltipBg,
                        titleColor: c.tooltipTitle,
                        bodyColor: c.tooltipBody,
                        borderColor: c.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        callbacks: {
                            title: (items) => labels[items[0].dataIndex]
                        },
                        titleFont: { family: "'Klapt', 'Barlow Condensed', sans-serif", weight: '500', size: 13 },
                        bodyFont: { family: "'Klapt', 'Barlow Condensed', sans-serif", size: 12 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: { color: c.grid, drawBorder: false },
                        ticks: {
                            color: c.tick,
                            stepSize: 1,
                            padding: 8,
                            font: { family: "'Klapt', 'Barlow Condensed', sans-serif", size: 11 }
                        }
                    },
                    x: {
                        type: 'linear',
                        min: 0,
                        max: data.length - 1,
                        border: { display: false },
                        grid: { display: false },
                        ticks: {
                            color: c.tick,
                            stepSize: 1,
                            padding: 8,
                            callback: (val) => labels[val] ?? '',
                            font: { family: "'Klapt', 'Barlow Condensed', sans-serif", size: 11 }
                        }
                    }
                }
            }
        });
    }

    function updateChartColors() {
        if (!playerChart) return;
        const c = getChartColors();
        playerChart.options.scales.y.grid.color = c.grid;
        playerChart.options.scales.y.ticks.color = c.tick;
        playerChart.options.scales.x.ticks.color = c.tick;
        playerChart.options.plugins.legend.labels.color = c.legend;
        playerChart.options.plugins.tooltip.backgroundColor = c.tooltipBg;
        playerChart.options.plugins.tooltip.titleColor = c.tooltipTitle;
        playerChart.options.plugins.tooltip.bodyColor = c.tooltipBody;
        playerChart.options.plugins.tooltip.borderColor = c.tooltipBorder;
        // Rebuild gradients with updated background color
        playerChart.data.datasets[0].pointBorderColor = c.tooltipBg;
        playerChart.data.datasets[1].pointBorderColor = c.tooltipBg;
        playerChart.update('none');
    }

    // =============================================
    // CONFRONTATIONS
    // =============================================
    let currentConfrontSeason = '2026';

    // Season selector for confrontations
    document.getElementById('confront-season-selector')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.season-btn');
        if (!btn) return;
        e.currentTarget.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentConfrontSeason = btn.dataset.year;
        buildConfrontation();
    });

    function initConfrontations() {
        const selA = document.getElementById('confront-player-a');
        const selB = document.getElementById('confront-player-b');
        if (!selA || !selB) return;

        const names = Object.keys(window.playerHistory || {}).sort();
        [selA, selB].forEach((sel, idx) => {
            const prev = sel.value;
            sel.innerHTML = '<option value="">Choisir...</option>' +
                names.map(n => `<option value="${n}"${n === prev ? ' selected' : ''}>${n}</option>`).join('');
            if (!prev && names.length > idx) {
                sel.value = names[idx] || '';
            }
        });
        selA.onchange = selB.onchange = () => buildConfrontation();
        buildConfrontation();
    }

    function inTeamFuzzy(team, name) {
        return (team || []).some(p => nameMatches(p, name));
    }

    function buildConfrontation() {
        const nameA = document.getElementById('confront-player-a')?.value;
        const nameB = document.getElementById('confront-player-b')?.value;
        const container = document.getElementById('confrontation-content');
        if (!container) return;
        if (!nameA || !nameB || nameA === nameB) {
            container.innerHTML = '<div class="no-data" style="padding:40px;text-align:center">Selectionne deux joueurs differents</div>';
            return;
        }

        const yr = currentConfrontSeason;
        const allStats = computePlayerStats(yr);
        const empty = { matches: 0, goals: 0, assists: 0, ratio: 0, wins: 0, draws: 0, losses: 0, formRatio: 0 };
        const stA = allStats[nameA] || empty;
        const stB = allStats[nameB] || empty;

        // Filter replays by season
        const filteredReplays = filterReplaysByYear(yr);

        // H2H & same team analysis
        let h2hWinsA = 0, h2hWinsB = 0, h2hDraws = 0;
        let sameTeamWins = 0, sameTeamLosses = 0, sameTeamDraws = 0, sameTeamTotal = 0;
        let h2hTotal = 0;

        filteredReplays.forEach(match => {
            const aInA = inTeamFuzzy(match.teamA, nameA), aInB = inTeamFuzzy(match.teamB, nameA);
            const bInA = inTeamFuzzy(match.teamA, nameB), bInB = inTeamFuzzy(match.teamB, nameB);
            if (!(aInA || aInB) || !(bInA || bInB)) return;

            const sA = parseInt(match.scoreA), sB = parseInt(match.scoreB);
            const sameTeam = (aInA && bInA) || (aInB && bInB);

            if (sameTeam) {
                sameTeamTotal++;
                const teamScore = aInA ? sA : sB;
                const otherScore = aInA ? sB : sA;
                if (teamScore > otherScore) sameTeamWins++;
                else if (teamScore < otherScore) sameTeamLosses++;
                else sameTeamDraws++;
            } else {
                h2hTotal++;
                const aScore = aInA ? sA : sB;
                const bScore = bInA ? sA : sB;
                if (aScore > bScore) h2hWinsA++;
                else if (bScore > aScore) h2hWinsB++;
                else h2hDraws++;
            }
        });

        function compBar(valA, valB, label, fmtA, fmtB) {
            const max = Math.max(valA, valB, 1);
            const pctA = (valA / max) * 100;
            const pctB = (valB / max) * 100;
            const winA = valA > valB ? ' bar-lead' : '';
            const winB = valB > valA ? ' bar-lead' : '';
            return `
                <div class="comp-row">
                    <span class="comp-val left${winA}">${fmtA ?? valA}</span>
                    <div class="comp-bar-wrap">
                        <div class="comp-bar left${winA}" style="width:${pctA}%"></div>
                        <span class="comp-label">${label}</span>
                        <div class="comp-bar right${winB}" style="width:${pctB}%"></div>
                    </div>
                    <span class="comp-val right${winB}">${fmtB ?? valB}</span>
                </div>`;
        }

        // Ratio = (W + D*0.5) / total * 100
        const sameTeamRatio = sameTeamTotal > 0 ? Math.round((sameTeamWins + sameTeamDraws * 0.5) / sameTeamTotal * 100) : 0;

        container.innerHTML = `
            <div class="confront-profiles">
                <div class="confront-profile">
                    <img src="${playerImg(nameA)}" alt="${nameA}" onerror="this.src='${fallbackImg(nameA)}'">
                    <h3>${nameA}</h3>
                </div>
                <div class="confront-profile">
                    <img src="${playerImg(nameB)}" alt="${nameB}" onerror="this.src='${fallbackImg(nameB)}'">
                    <h3>${nameB}</h3>
                </div>
            </div>
            <div class="confront-section">
                <h4>Comparaison globale</h4>
                <div class="comp-bars">
                    ${compBar(stA.matches, stB.matches, 'Matchs')}
                    ${compBar(stA.goals, stB.goals, 'Buts')}
                    ${compBar(stA.assists, stB.assists, 'Passes D.')}
                    ${compBar(stA.goals + stA.assists, stB.goals + stB.assists, 'G+A')}
                    ${compBar(stA.ratio, stB.ratio, 'Buts/M', stA.ratio.toFixed(2), stB.ratio.toFixed(2))}
                    ${compBar(stA.formRatio, stB.formRatio, 'Ratio V.', stA.formRatio + '%', stB.formRatio + '%')}
                    ${compBar(stA.wins, stB.wins, 'Victoires')}
                </div>
            </div>
            ${h2hTotal > 0 ? `
            <div class="confront-section">
                <h4>Face a face <span class="section-badge">${h2hTotal} match${h2hTotal > 1 ? 's' : ''}</span></h4>
                <div class="h2h-summary">
                    <div class="h2h-block ${h2hWinsA > h2hWinsB ? 'lead' : ''}">
                        <span class="h2h-val">${h2hWinsA}</span>
                        <span class="h2h-lbl">V. ${nameA.split(' ')[0]}</span>
                    </div>
                    <div class="h2h-block draw">
                        <span class="h2h-val">${h2hDraws}</span>
                        <span class="h2h-lbl">Nuls</span>
                    </div>
                    <div class="h2h-block ${h2hWinsB > h2hWinsA ? 'lead' : ''}">
                        <span class="h2h-val">${h2hWinsB}</span>
                        <span class="h2h-lbl">V. ${nameB.split(' ')[0]}</span>
                    </div>
                </div>
            </div>` : ''}
            ${sameTeamTotal > 0 ? `
            <div class="confront-section">
                <h4>Meme equipe <span class="section-badge">${sameTeamTotal} match${sameTeamTotal > 1 ? 's' : ''}</span></h4>
                <div class="same-team-summary">
                    <div class="same-team-stat win"><span class="st-val">${sameTeamWins}</span><span class="st-lbl">V</span></div>
                    <div class="same-team-stat draw"><span class="st-val">${sameTeamDraws}</span><span class="st-lbl">N</span></div>
                    <div class="same-team-stat loss"><span class="st-val">${sameTeamLosses}</span><span class="st-lbl">D</span></div>
                    <div class="same-team-pct">${sameTeamRatio}% ratio de victoires ensemble</div>
                </div>
            </div>` : ''}
            ${h2hTotal === 0 && sameTeamTotal === 0 ? '<div class="no-data" style="padding:20px;text-align:center">Ces joueurs n\'ont jamais joue dans le meme match</div>' : ''}
        `;
    }

    // =============================================
    // STATS PAGE — Records & Heatmap
    // =============================================
    function buildStatsPage() {
        const container = document.getElementById('stats-content');
        if (!container) return;

        const replays = window.replays || [];
        const history = window.playerHistory || {};

        // ---- HEATMAP DATA ----
        const heatmapHtml = buildWeeklyHeatmap(replays);

        // ---- BEST DUOS (ratio = W*1 + D*0.5 / total) ----
        const duoMap = {};
        replays.forEach(match => {
            const sA = parseInt(match.scoreA), sB = parseInt(match.scoreB);
            [[match.teamA, sA, sB], [match.teamB, sB, sA]].forEach(([team, ts, os]) => {
                if (!team) return;
                for (let i = 0; i < team.length; i++) {
                    for (let j = i + 1; j < team.length; j++) {
                        const key = [team[i], team[j]].sort().join(' & ');
                        if (!duoMap[key]) duoMap[key] = { played: 0, wins: 0, draws: 0 };
                        duoMap[key].played++;
                        if (ts > os) duoMap[key].wins++;
                        else if (ts === os) duoMap[key].draws++;
                    }
                }
            });
        });
        const bestDuos = Object.entries(duoMap)
            .filter(([, v]) => v.played >= 3)
            .map(([k, v]) => ({
                duo: k, ...v,
                ratio: Math.round((v.wins + v.draws * 0.5) / v.played * 100)
            }))
            .sort((a, b) => b.ratio - a.ratio || b.wins - a.wins || b.played - a.played)
            .slice(0, 5);

        // ---- TOP 5 BUTS EN 1 MATCH ----
        const singleMatchGoals = [];
        Object.entries(history).forEach(([name, entries]) => {
            entries.forEach(e => singleMatchGoals.push({ name, date: e.date, goals: e.goals }));
        });
        const top5Goals = singleMatchGoals.sort((a, b) => b.goals - a.goals).slice(0, 5);

        // ---- TOP 5 PASSES DÉ EN 1 MATCH ----
        const singleMatchAssists = [];
        Object.entries(history).forEach(([name, entries]) => {
            entries.forEach(e => singleMatchAssists.push({ name, date: e.date, assists: e.assists }));
        });
        const top5Assists = singleMatchAssists.sort((a, b) => b.assists - a.assists).slice(0, 5);

        // ---- TOP 5 G+A EN 1 MATCH ----
        const singleMatchGA = [];
        Object.entries(history).forEach(([name, entries]) => {
            entries.forEach(e => singleMatchGA.push({ name, date: e.date, ga: e.goals + e.assists }));
        });
        const top5GA = singleMatchGA.sort((a, b) => b.ga - a.ga).slice(0, 5);

        // ---- TOP 5 WIN STREAKS ----
        const streaks = [];
        Object.entries(history).forEach(([name, entries]) => {
            let best = 0, cur = 0;
            entries.forEach(e => {
                const r = getMatchResult(name, e.date);
                if (r === 'win') { cur++; if (cur > best) best = cur; }
                else cur = 0;
            });
            if (best >= 2) streaks.push({ name, streak: best });
        });
        const topStreaks = streaks.sort((a, b) => b.streak - a.streak).slice(0, 5);

        // ---- TOP 5 LOSS STREAKS ----
        const lossStreaks = [];
        Object.entries(history).forEach(([name, entries]) => {
            let worst = 0, cur = 0;
            entries.forEach(e => {
                const r = getMatchResult(name, e.date);
                if (r === 'loss') { cur++; if (cur > worst) worst = cur; }
                else cur = 0;
            });
            if (worst >= 2) lossStreaks.push({ name, streak: worst });
        });
        const topLossStreaks = lossStreaks.sort((a, b) => b.streak - a.streak).slice(0, 5);

        // ---- BIGGEST WIN ----
        let biggestWin = null;
        replays.forEach(match => {
            const diff = Math.abs(parseInt(match.scoreA) - parseInt(match.scoreB));
            if (!biggestWin || diff > biggestWin.diff) {
                biggestWin = { date: match.date, scoreA: match.scoreA, scoreB: match.scoreB, diff };
            }
        });

        // ---- MOST GOALS MATCH ----
        let mostGoalsMatch = null;
        replays.forEach(match => {
            const total = parseInt(match.scoreA) + parseInt(match.scoreB);
            if (!mostGoalsMatch || total > mostGoalsMatch.total) {
                mostGoalsMatch = { date: match.date, scoreA: match.scoreA, scoreB: match.scoreB, total };
            }
        });

        // ---- TOP 5 PASSEURS (total assists) ----
        const topPasseurs = Object.entries(history)
            .map(([name, entries]) => ({
                name,
                assists: entries.reduce((s, e) => s + (e.assists || 0), 0),
                matches: entries.length
            }))
            .filter(p => p.matches >= 2)
            .sort((a, b) => b.assists - a.assists || b.matches - a.matches)
            .slice(0, 5);

        // ---- TOP 5 GA/MATCH (min 5 matchs) ----
        const topGAperMatch = Object.entries(history)
            .map(([name, entries]) => {
                const ga = entries.reduce((s, e) => s + (e.goals || 0) + (e.assists || 0), 0);
                return { name, ga, matches: entries.length, ratio: entries.length > 0 ? ga / entries.length : 0 };
            })
            .filter(p => p.matches >= 5)
            .sort((a, b) => b.ratio - a.ratio || b.ga - a.ga)
            .slice(0, 5);

        // ---- GHOSTS (most matches at 0 goals) ----
        const ghostPlayers = [];
        Object.entries(history).forEach(([name, entries]) => {
            const zeroGoals = entries.filter(e => e.goals === 0).length;
            if (zeroGoals >= 2 && entries.length >= 3) {
                ghostPlayers.push({ name, zero: zeroGoals, total: entries.length, pct: Math.round(zeroGoals / entries.length * 100) });
            }
        });
        const topGhosts = ghostPlayers.sort((a, b) => b.pct - a.pct).slice(0, 5);

        // Render
        function medal(i) {
            return ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
        }

        container.innerHTML = `
            <div class="stats-section">
                <h4>Calendrier des matchs</h4>
                ${heatmapHtml}
            </div>

            <div class="stats-grid-2col">
                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-handshake"></i> Meilleurs duos</h4>
                    <div class="stats-list">
                        ${bestDuos.map((d, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${d.duo}</span>
                                <span class="stats-val">${d.ratio}% <small>(${d.wins}V ${d.draws}N/${d.played}m)</small></span>
                            </div>`).join('') || '<div class="no-data">Pas assez de donnees</div>'}
                    </div>
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-fire"></i> Meilleures series de victoires</h4>
                    <div class="stats-list">
                        ${topStreaks.map((s, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${s.name}</span>
                                <span class="stats-val">${s.streak} matchs</span>
                            </div>`).join('') || '<div class="no-data">Pas assez de donnees</div>'}
                    </div>
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-regular fa-futbol"></i> Record buts en 1 match</h4>
                    <div class="stats-list">
                        ${top5Goals.map((g, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${g.name}</span>
                                <span class="stats-val">${g.goals} buts <small>${g.date}</small></span>
                            </div>`).join('')}
                    </div>
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-hands-helping"></i> Record passes D. en 1 match</h4>
                    <div class="stats-list">
                        ${top5Assists.map((a, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${a.name}</span>
                                <span class="stats-val">${a.assists} passes <small>${a.date}</small></span>
                            </div>`).join('')}
                    </div>
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-star"></i> Record G+A en 1 match</h4>
                    <div class="stats-list">
                        ${top5GA.map((g, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${g.name}</span>
                                <span class="stats-val">${g.ga} G+A <small>${g.date}</small></span>
                            </div>`).join('')}
                    </div>
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-skull"></i> Pires series de defaites</h4>
                    <div class="stats-list">
                        ${topLossStreaks.map((s, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${s.name}</span>
                                <span class="stats-val">${s.streak} matchs</span>
                            </div>`).join('') || '<div class="no-data">Pas assez de donnees</div>'}
                    </div>
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-bomb"></i> Plus gros ecart</h4>
                    ${biggestWin ? `
                    <div class="stats-highlight">
                        <span class="stats-big-score">${biggestWin.scoreA} - ${biggestWin.scoreB}</span>
                        <span class="stats-date">${biggestWin.date}</span>
                        <span class="stats-sub">Ecart de ${biggestWin.diff} buts</span>
                    </div>` : '<div class="no-data">—</div>'}
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-futbol"></i> Match le plus prolifique</h4>
                    ${mostGoalsMatch ? `
                    <div class="stats-highlight">
                        <span class="stats-big-score">${mostGoalsMatch.scoreA} - ${mostGoalsMatch.scoreB}</span>
                        <span class="stats-date">${mostGoalsMatch.date}</span>
                        <span class="stats-sub">${mostGoalsMatch.total} buts au total</span>
                    </div>` : '<div class="no-data">—</div>'}
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-ghost"></i> Fantomes (% matchs a 0 but)</h4>
                    <div class="stats-list">
                        ${topGhosts.map((g, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${g.name}</span>
                                <span class="stats-val">${g.pct}% <small>(${g.zero}/${g.total})</small></span>
                            </div>`).join('') || '<div class="no-data">—</div>'}
                    </div>
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-shoe-prints"></i> Meilleurs passeurs (total)</h4>
                    <div class="stats-list">
                        ${topPasseurs.map((p, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${p.name}</span>
                                <span class="stats-val">${p.assists} passes <small>(${p.matches}m)</small></span>
                            </div>`).join('') || '<div class="no-data">—</div>'}
                    </div>
                </div>

                <div class="stats-section stats-card">
                    <h4><i class="fa-solid fa-bolt"></i> G+A par match (min. 5 matchs)</h4>
                    <div class="stats-list">
                        ${topGAperMatch.map((p, i) => `
                            <div class="stats-list-row">
                                <span class="stats-medal">${medal(i)}</span>
                                <span class="stats-name">${p.name}</span>
                                <span class="stats-val">${p.ratio.toFixed(2)} <small>(${p.ga} G+A/${p.matches}m)</small></span>
                            </div>`).join('') || '<div class="no-data">Pas assez de donnees</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    // ---- HEATMAP: Weekly view — 52 cells per year, intensity = nb of matches that week ----
    function buildWeeklyHeatmap(replays) {
        if (!replays.length) return '<div class="no-data">Aucun match</div>';

        // Count matches per ISO week
        const weekMap = {};
        replays.forEach(m => {
            const d = parseDate(m.date);
            const wk = getISOWeekKey(d);
            if (!weekMap[wk]) weekMap[wk] = { count: 0, dates: [] };
            weekMap[wk].count++;
            weekMap[wk].dates.push(m.date);
        });

        // Get year range
        const dates = replays.map(m => parseDate(m.date)).sort((a, b) => a - b);
        const startYear = dates[0].getFullYear();
        const endYear = dates[dates.length - 1].getFullYear();

        const months = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

        let yearsHtml = '';
        for (let year = startYear; year <= endYear; year++) {
            let weeksHtml = '';
            let monthLabels = '';
            let lastMonth = -1;

            // Iterate all 52-53 weeks of the year
            const jan1 = new Date(year, 0, 1);
            const startSunday = new Date(jan1);
            startSunday.setDate(jan1.getDate() - jan1.getDay());

            let totalWeeks = 0;
            // First pass: count weeks to compute percentage offsets
            const weekData = [];
            for (let w = 0; w < 53; w++) {
                const weekStart = new Date(startSunday);
                weekStart.setDate(startSunday.getDate() + w * 7);
                if (weekStart.getFullYear() > year && w > 0) break;
                weekData.push({ w, weekStart });
                totalWeeks = w + 1;
            }

            weekData.forEach(({ w, weekStart }) => {
                const wk = getISOWeekKey(weekStart);
                const data = weekMap[wk];
                let cls = 'heatmap-cell';
                let tooltip = '';
                if (data) {
                    const level = Math.min(data.count, 4);
                    cls = `heatmap-cell match level-${level}`;
                    tooltip = `Semaine ${w + 1} ${year} — ${data.count} match${data.count > 1 ? 's' : ''}`;
                }
                weeksHtml += `<div class="${cls}" ${tooltip ? `title="${tooltip}"` : ''}></div>`;

                // Month labels using percentage position
                const mid = new Date(weekStart);
                mid.setDate(mid.getDate() + 3);
                if (mid.getMonth() !== lastMonth && mid.getFullYear() === year) {
                    const pct = (w / totalWeeks * 100).toFixed(1);
                    monthLabels += `<span class="heatmap-month" style="left:${pct}%">${months[mid.getMonth()]}</span>`;
                    lastMonth = mid.getMonth();
                }
            });

            yearsHtml += `
                <div class="heatmap-year-row">
                    <span class="heatmap-year-label">${year}</span>
                    <div class="heatmap-year-col">
                        <div class="heatmap-months" style="--hm-weeks:${totalWeeks}">${monthLabels}</div>
                        <div class="heatmap-weeks" style="grid-template-columns:repeat(${totalWeeks},1fr)">${weeksHtml}</div>
                    </div>
                </div>`;
        }

        return `
            <div class="heatmap-container">
                ${yearsHtml}
                <div class="heatmap-legend">
                    <span>Aucun</span>
                    <div class="heatmap-cell empty"></div>
                    <div class="heatmap-cell match level-1"></div>
                    <div class="heatmap-cell match level-2"></div>
                    <div class="heatmap-cell match level-3"></div>
                    <div class="heatmap-cell match level-4"></div>
                    <span>4+ matchs</span>
                </div>
            </div>`;
    }

    function getISOWeekKey(d) {
        const date = new Date(d);
        date.setDate(date.getDate() - date.getDay());
        return `${date.getFullYear()}-W${String(Math.ceil((((date - new Date(date.getFullYear(), 0, 1)) / 86400000) + 1) / 7)).padStart(2, '0')}`;
    }

    // =============================================
    // INIT
    // =============================================
    buildReplayList();
});
