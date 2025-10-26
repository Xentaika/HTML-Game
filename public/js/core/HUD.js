import { BUY_MENU_SECTIONS, WEAPON_PRESETS } from '../config/weaponPresets.js';

export class HUDOverlay {
  constructor() {
    this.overlay = document.getElementById('overlay');
    this.startPrompt = document.getElementById('startPrompt');
    this.healthFill = document.getElementById('healthFill');
    this.healthValue = document.getElementById('healthValue');
    this.armorFill = document.getElementById('armorFill');
    this.armorValue = document.getElementById('armorValue');
    this.weaponName = document.getElementById('weaponName');
    this.ammoMagazine = document.getElementById('ammoMagazine');
    this.ammoReserve = document.getElementById('ammoReserve');
    this.reloadIndicator = document.getElementById('reloadIndicator');
    this.cashDisplay = document.getElementById('cashDisplay');
    this.scoreDisplay = document.getElementById('scoreDisplay');
    this.eventFeed = document.getElementById('eventFeed');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.serverStats = document.getElementById('serverStats');
    this.pingValue = document.getElementById('pingValue');
    this.tickValue = document.getElementById('tickValue');
    this.crosshair = document.getElementById('crosshair');
    this.hitMarker = document.getElementById('hitMarker');
    this.buyPrompt = document.getElementById('buyPrompt');
    this.buyMenu = document.getElementById('buyMenu');
    this.buyMenuContent = document.getElementById('buyMenuContent');
    this.scoreboard = document.getElementById('scoreboard');

    this.crosshairTimeout = null;
    this.hitMarkerTimeout = null;
    this.hitMarkerHideTimeout = null;
  }

  updatePlayerStats(player) {
    if (!player) {
      return;
    }
    if (this.healthFill) {
      const health = Math.max(0, Math.round(player.health));
      this.healthFill.style.width = `${health}%`;
      this.healthValue.textContent = health;
    }
    if (this.armorFill) {
      const armor = Math.max(0, Math.round(player.armor || 0));
      this.armorFill.style.width = `${Math.min(100, armor)}%`;
      this.armorValue.textContent = armor;
    }
    if (this.weaponName && player.weapon) {
      this.weaponName.textContent = player.weapon.name;
      const mag = player.weapon.ammo == null ? '∞' : player.weapon.ammo;
      const reserve = player.weapon.reserve == null ? '∞' : player.weapon.reserve;
      this.ammoMagazine.textContent = mag;
      this.ammoReserve.textContent = reserve;
    }
    if (this.cashDisplay) {
      this.cashDisplay.textContent = `$${Math.max(0, Math.round(player.cash ?? 0))}`;
    }
    if (this.scoreDisplay) {
      this.scoreDisplay.textContent = Math.round(player.score ?? 0);
    }
  }

  toggleStartPrompt(show) {
    if (!this.startPrompt) {
      return;
    }
    this.startPrompt.classList.toggle('hidden', !show);
  }

  setConnectionStatus(message, visible = true) {
    if (!this.connectionStatus) {
      return;
    }
    this.connectionStatus.textContent = message;
    this.connectionStatus.classList.toggle('hidden', !visible);
  }

  updateServerStats(stats) {
    if (!this.serverStats) {
      return;
    }
    const hasData = Boolean(stats && (stats.ping != null || stats.tickRate != null || stats.targetTickRate != null));
    this.serverStats.classList.toggle('hidden', !hasData);
    if (!hasData) {
      if (this.pingValue) {
        this.pingValue.textContent = '—';
      }
      if (this.tickValue) {
        this.tickValue.textContent = '—';
      }
      return;
    }
    if (this.pingValue) {
      this.pingValue.textContent = stats.ping != null ? `${Math.round(stats.ping)} мс` : '—';
    }
    if (this.tickValue) {
      const rate = stats.tickRate != null ? stats.tickRate : stats.targetTickRate;
      this.tickValue.textContent = rate != null ? `${Math.round(rate)} тиков/с` : '—';
    }
  }

  setReloadIndicator(visible, message = 'Перезарядка…') {
    if (!this.reloadIndicator) {
      return;
    }
    this.reloadIndicator.textContent = message;
    this.reloadIndicator.classList.toggle('hidden', !visible);
  }

  animateCrosshair(state) {
    if (!this.crosshair) {
      return;
    }
    if (state === 'fire') {
      this.crosshair.classList.add('firing');
      clearTimeout(this.crosshairTimeout);
      this.crosshairTimeout = setTimeout(() => this.crosshair.classList.remove('firing'), 90);
    } else if (state === 'hit' || state === 'headshot') {
      this.crosshair.classList.remove('hit', 'headshot');
      this.crosshair.classList.add(state);
      clearTimeout(this.crosshairTimeout);
      this.crosshairTimeout = setTimeout(() => {
        this.crosshair.classList.remove('hit', 'headshot');
      }, 160);
    }
  }

  showHitMarker(headshot = false) {
    if (!this.hitMarker) {
      return;
    }
    this.hitMarker.classList.toggle('headshot', headshot);
    this.hitMarker.classList.remove('hidden');
    this.hitMarker.classList.add('visible');
    clearTimeout(this.hitMarkerTimeout);
    clearTimeout(this.hitMarkerHideTimeout);
    this.hitMarkerTimeout = setTimeout(() => {
      this.hitMarker.classList.remove('visible');
      this.hitMarkerHideTimeout = setTimeout(() => this.hitMarker.classList.add('hidden'), 90);
    }, 120);
  }

  addFeedEntry(text, headshot = false) {
    if (!this.eventFeed) {
      return;
    }
    const entry = document.createElement('div');
    entry.className = `feed-item${headshot ? ' headshot' : ''}`;
    entry.textContent = text;
    this.eventFeed.appendChild(entry);
    const items = this.eventFeed.querySelectorAll('.feed-item');
    if (items.length > 6) {
      items[0].remove();
    }
    setTimeout(() => entry.remove(), 8000);
  }

  setBuyPrompt(visible) {
    if (!this.buyPrompt) {
      return;
    }
    this.buyPrompt.classList.toggle('hidden', !visible);
  }

  toggleBuyMenu(show) {
    if (!this.buyMenu) {
      return;
    }
    this.buyMenu.classList.toggle('hidden', !show);
  }

  renderBuyMenu(cash, _inventory, onPurchase = () => {}) {
    if (!this.buyMenuContent) {
      return;
    }
    this.buyMenuContent.innerHTML = '';
    BUY_MENU_SECTIONS.forEach((section) => {
      const container = document.createElement('section');
      container.className = 'buy-section';
      const title = document.createElement('h3');
      title.className = 'buy-section__title';
      title.textContent = section.title;
      container.appendChild(title);

      section.items.forEach((weaponId) => {
        const preset = WEAPON_PRESETS[weaponId];
        if (!preset) {
          return;
        }
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'buy-card';
        const affordable = cash >= preset.price;
        if (!affordable) {
          card.classList.add('disabled');
        }
        card.innerHTML = `
          <span class="buy-card__name">${preset.name}</span>
          <span class="buy-card__price">$${preset.price}</span>
          <span class="buy-card__stats">${preset.magazineSize ?? '∞'} | ${preset.bodyDamage}</span>
        `;
        card.disabled = !affordable;
        card.addEventListener('click', () => {
          if (affordable) {
            onPurchase(weaponId);
          }
        });
        container.appendChild(card);
      });
      this.buyMenuContent.appendChild(container);
    });
  }

  toggleScoreboard(show, players = []) {
    if (!this.scoreboard) {
      return;
    }
    this.scoreboard.classList.toggle('hidden', !show);
    if (!show) {
      this.scoreboard.innerHTML = '';
      return;
    }
    const header = document.createElement('div');
    header.className = 'scoreboard__header';
    header.textContent = 'Статистика';
    const list = document.createElement('ul');
    list.className = 'scoreboard__list';
    players
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .forEach((player) => {
        const item = document.createElement('li');
        item.className = 'scoreboard__item';
        item.textContent = `${player.id.slice(0, 6)} — ${player.score ?? 0}`;
        list.appendChild(item);
      });
    this.scoreboard.innerHTML = '';
    this.scoreboard.appendChild(header);
    this.scoreboard.appendChild(list);
  }
}
