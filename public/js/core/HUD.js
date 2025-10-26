export class HUDOverlay {
  constructor() {
    this.overlay = document.getElementById('overlay');
    this.startPrompt = document.getElementById('startPrompt');
    this.buyPrompt = document.getElementById('buyPrompt');
    this.healthFill = document.getElementById('healthFill');
    this.healthValue = document.getElementById('healthValue');
    this.weaponName = document.getElementById('weaponName');
    this.ammoDisplay = document.getElementById('ammoDisplay');
    this.reloadIndicator = document.getElementById('reloadIndicator');
    this.moneyDisplay = document.getElementById('moneyDisplay');
    this.scoreDisplay = document.getElementById('scoreDisplay');
    this.eventFeed = document.getElementById('eventFeed');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.serverStats = document.getElementById('serverStats');
    this.pingValue = document.getElementById('pingValue');
    this.tickValue = document.getElementById('tickValue');
    this.crosshair = document.getElementById('crosshair');
    this.hitMarker = document.getElementById('hitMarker');
    this.buyMenu = document.getElementById('buyMenu');
    this.buyCategories = document.getElementById('buyCategories');
    this.buyItems = document.getElementById('buyItems');
    this.closeBuyMenuBtn = document.getElementById('closeBuyMenu');
    this.buyHint = document.getElementById('buyHint');

    this.crosshairTimeout = null;
    this.hitMarkerTimeout = null;
    this.hitMarkerHideTimeout = null;

    this.weaponCatalog = {};
    this.categorisedWeapons = new Map();
    this.activeCategory = null;

    this.onBuyRequest = () => {};
  }

  toggleStartPrompt(show) {
    if (!this.startPrompt) {
      return;
    }
    this.startPrompt.classList.toggle('hidden', !show);
    this.overlay?.classList.toggle('has-prompt', show);
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
    const hasData = Boolean(
      stats && (stats.ping != null || stats.tickRate != null || stats.targetTickRate != null)
    );
    this.serverStats.classList.toggle('hidden', !hasData);
    if (!hasData) {
      return;
    }
    if (this.pingValue) {
      this.pingValue.textContent = stats.ping != null ? `${Math.round(stats.ping)} мс` : '—';
    }
    if (this.tickValue) {
      const tickRateText =
        stats.tickRate != null
          ? `${Math.round(stats.tickRate)} тиков/с`
          : stats.targetTickRate != null
          ? `${Math.round(stats.targetTickRate)} тиков/с`
          : '—';
      this.tickValue.textContent = tickRateText;
    }
  }

  setWeaponCatalog(catalog) {
    this.weaponCatalog = catalog || {};
    const categoryMap = new Map();
    Object.entries(this.weaponCatalog).forEach(([id, data]) => {
      const category = data.category || data.slot || 'Прочее';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category).push({ id, ...data });
    });
    this.categorisedWeapons = categoryMap;
    this.buildBuyMenu();
  }

  buildBuyMenu() {
    if (!this.buyCategories || !this.buyItems) {
      return;
    }
    this.buyCategories.innerHTML = '';
    this.buyItems.innerHTML = '';
    const categories = Array.from(this.categorisedWeapons.keys());
    if (categories.length === 0) {
      return;
    }
    if (!this.activeCategory || !this.categorisedWeapons.has(this.activeCategory)) {
      this.activeCategory = categories[0];
    }
    categories.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category;
      button.className = `buy-category${category === this.activeCategory ? ' active' : ''}`;
      button.addEventListener('click', () => {
        this.activeCategory = category;
        this.buildBuyMenu();
      });
      this.buyCategories.appendChild(button);
    });
    this.renderCategoryItems();
  }

  renderCategoryItems(player) {
    if (!this.buyItems) {
      return;
    }
    this.buyItems.innerHTML = '';
    const items = this.categorisedWeapons.get(this.activeCategory) || [];
    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'buy-card';
      card.dataset.weaponId = item.id;

      const title = document.createElement('h3');
      title.textContent = item.name;
      card.appendChild(title);

      const price = document.createElement('div');
      price.className = 'price';
      price.textContent = `$${item.price}`;
      card.appendChild(price);

      const stats = document.createElement('div');
      stats.className = 'stats';
      const dps = Math.round((item.bodyDamage / Math.max(item.fireRate, 0.01)) * 10) / 10;
      stats.innerHTML = `Урон: ${item.bodyDamage} / ${item.headshotDamage}<br />ROF: ${(
        60 / Math.max(item.fireRate, 0.01)
      ).toFixed(0)} выстр./мин<br />ДПС: ${dps}`;
      card.appendChild(stats);

      card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) {
          return;
        }
        this.onBuyRequest(item.id);
      });

      this.buyItems.appendChild(card);
    });

    if (player) {
      this.updateBuyAvailability(player);
    }
  }

  updateBuyAvailability(player) {
    if (!player || !this.buyItems) {
      return;
    }
    const cards = this.buyItems.querySelectorAll('.buy-card');
    cards.forEach((card) => {
      const weaponId = card.dataset.weaponId;
      const template = this.weaponCatalog[weaponId];
      if (!template) {
        return;
      }
      let slot = template.slot;
      if (slot === 'sniper') {
        slot = 'primary';
      }
      const hasWeapon = Boolean(player.inventory && player.inventory[slot]?.id === weaponId);
      const affordable = player.money >= template.price;
      const inZone = Boolean(player.inBuyZone);
      const enabled = affordable && inZone && !hasWeapon;
      card.classList.toggle('disabled', !enabled);
    });
    if (this.buyHint) {
      this.buyHint.textContent = player.inBuyZone
        ? 'Выберите оружие для покупки.'
        : 'Вернитесь в зону покупки, чтобы приобрести оружие.';
    }
  }

  toggleBuyMenu(show, player) {
    if (!this.buyMenu) {
      return;
    }
    this.buyMenu.classList.toggle('hidden', !show);
    this.overlay?.classList.toggle('menu-open', show);
    if (show) {
      this.renderCategoryItems(player);
    }
  }

  showBuyPrompt(show) {
    if (!this.buyPrompt) {
      return;
    }
    this.buyPrompt.classList.toggle('hidden', !show);
  }

  updatePlayerStats(player) {
    if (!player) {
      return;
    }
    if (this.healthFill) {
      const value = Math.max(0, Math.round(player.health));
      this.healthFill.style.width = `${value}%`;
      this.healthFill.style.background =
        value > 30 ? 'linear-gradient(90deg, #4e8c53, #8ebf72)' : 'linear-gradient(90deg, #8c3f3f, #bf5454)';
    }
    if (this.healthValue) {
      this.healthValue.textContent = Math.max(0, Math.round(player.health));
    }
    if (this.weaponName) {
      this.weaponName.textContent = player.weapon?.name || 'Без оружия';
    }
    if (this.ammoDisplay) {
      if (player.weapon && !player.weapon.isMelee) {
        this.ammoDisplay.textContent = `${player.weapon.ammo} / ${player.weapon.reserve}`;
      } else {
        this.ammoDisplay.textContent = '—';
      }
    }
    if (this.moneyDisplay) {
      this.moneyDisplay.textContent = player.money != null ? player.money : '0';
    }
    if (this.scoreDisplay) {
      this.scoreDisplay.textContent = player.score != null ? player.score : '0';
    }
    this.updateBuyAvailability(player);
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
      return;
    }
    if (state === 'hit' || state === 'headshot') {
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
      this.hitMarkerHideTimeout = setTimeout(() => this.hitMarker.classList.add('hidden'), 120);
    }, 150);
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
    if (items.length > 7) {
      items[0].remove();
    }
    setTimeout(() => entry.remove(), 9000);
  }
}
