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
        // Trouver le nom exact dans history_data
        const historyName = Object.keys(window.playerHistory || {}).find(k => {
            const kL = k.toLowerCase().trim();
            const pL = playerName.toLowerCase().trim();
            return kL === pL ||
                   kL.startsWith(pL.split(' ')[0]) ||
                   pL.startsWith(kL.split(' ')[0]);
        });
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
        document.querySelector('[data-target="replays"]')?.classList.add('active');
        document.getElementById('replays')?.classList.add('active');
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
                    const hasHistory = Object.keys(window.playerHistory || {}).some(k => {
                        const kL = k.toLowerCase().trim();
                        const pL = p.toLowerCase().trim();
                        return kL === pL || kL.startsWith(pL.split(' ')[0]) || pL.startsWith(kL.split(' ')[0]);
                    });
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

        const nameL = name.toLowerCase().trim();
        function inTeam(team) {
            return (team || []).some(p => {
                const pL = p.toLowerCase().trim();
                return pL === nameL ||
                       pL.startsWith(nameL.split(' ')[0]) ||
                       nameL.startsWith(pL.split(' ')[0]);
            });
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
                    <span class="lbl">Défaites</span>
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
    // INIT
    // =============================================
    buildReplayList();
});
