export class HUDOverlay {
  constructor() {
    this.overlay = document.getElementById('overlay');
    this.startPrompt = document.getElementById('startPrompt');
    this.healthFill = document.getElementById('healthFill');
    this.healthValue = document.getElementById('healthValue');
    this.weaponName = document.getElementById('weaponName');
    this.ammoDisplay = document.getElementById('ammoDisplay');
    this.walletDisplay = document.getElementById('walletDisplay');
    this.scoreDisplay = document.getElementById('scoreDisplay');
    this.eventFeed = document.getElementById('eventFeed');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.serverStats = document.getElementById('serverStats');
    this.pingValue = document.getElementById('pingValue');
    this.tickValue = document.getElementById('tickValue');
    this.crosshair = document.getElementById('crosshair');
    this.hitMarker = document.getElementById('hitMarker');
    this.reloadIndicator = document.getElementById('reloadIndicator');
    this.buyZoneHint = document.getElementById('buyZoneHint');

    this.buyMenu = document.getElementById('buyMenu');
    this.buyList = document.getElementById('buyList');

    this.crosshairTimeout = null;
    this.hitMarkerTimeout = null;
    this.hitMarkerHideTimeout = null;
    this.onBuySelect = () => {};
    this.buyItems = new Map();
    this.buyMenuOpen = false;

    if (this.overlay) {
      const startVisible = this.startPrompt && !this.startPrompt.classList.contains('hidden');
      this.overlay.style.pointerEvents = startVisible ? 'auto' : 'none';
    }
  }

  setWeaponDefinitions(definitions, onSelect) {
    if (!this.buyList) {
      return;
    }
    this.onBuySelect = onSelect || (() => {});
    this.buyList.innerHTML = '';
    this.buyItems.clear();

    const groups = new Map();
    const slotOrder = ['knife', 'melee', 'sidearm', 'smg', 'rifle', 'sniper'];
    Object.values(definitions).forEach((def) => {
      const slot = def.slot || def.id;
      if (!groups.has(slot)) {
        groups.set(slot, []);
      }
      groups.get(slot).push(def);
    });

    const orderedSlots = Array.from(groups.keys()).sort((a, b) => {
      const ai = slotOrder.indexOf(a);
      const bi = slotOrder.indexOf(b);
      const aIndex = ai === -1 ? slotOrder.length : ai;
      const bIndex = bi === -1 ? slotOrder.length : bi;
      if (aIndex === bIndex) {
        return a.localeCompare(b);
      }
      return aIndex - bIndex;
    });

    orderedSlots.forEach((slot) => {
      const items = groups.get(slot) || [];
      const section = document.createElement('section');
      section.className = 'buy-section';
      const header = document.createElement('header');
      header.className = 'buy-section__header';
      const title = document.createElement('h3');
      title.textContent = this.translateSlot(slot);
      header.appendChild(title);
      section.appendChild(header);

      const list = document.createElement('div');
      list.className = 'buy-section__items';
      items
        .sort((a, b) => a.price - b.price)
        .forEach((item) => {
          const button = document.createElement('button');
          button.className = 'buy-item';
          button.type = 'button';
          button.dataset.weaponId = item.id;
          button.dataset.price = String(item.price);
          button.innerHTML = `
            <span class="buy-item__name">${item.name}</span>
            <span class="buy-item__price">$${item.price}</span>
          `;
          button.addEventListener('click', () => this.onBuySelect(item.id));
          list.appendChild(button);
          this.buyItems.set(item.id, button);
        });
      section.appendChild(list);
      this.buyList.appendChild(section);
    });
  }

  translateSlot(slot) {
    switch (slot) {
      case 'knife':
      case 'melee':
        return 'Ближний бой';
      case 'sidearm':
        return 'Пистолеты';
      case 'smg':
        return 'ПП';
      case 'rifle':
        return 'Штурмовые винтовки';
      case 'sniper':
        return 'Снайперские';
      default:
        return 'Снаряжение';
    }
  }

  toggleBuyMenu(show) {
    if (!this.buyMenu) {
      return;
    }
    this.buyMenuOpen = show;
    if (show) {
      this.buyMenu.classList.remove('hidden');
      this.buyMenu.focus();
      if (this.overlay) {
        this.overlay.style.pointerEvents = 'auto';
      }
    } else {
      this.buyMenu.classList.add('hidden');
      if (this.overlay && !this.buyMenuOpen) {
        this.overlay.style.pointerEvents = 'none';
      }
    }
  }

  updateBuyAvailability(wallet, inZone) {
    if (this.buyZoneHint) {
      this.buyZoneHint.textContent = inZone
        ? 'Вы в зоне закупки. Нажмите B.'
        : 'Зона закупки покинута';
      this.buyZoneHint.classList.toggle('active', inZone);
    }
    this.buyItems.forEach((button) => {
      const price = Number(button.dataset.price || '0');
      const affordable = wallet >= price && inZone;
      button.disabled = !affordable;
      button.classList.toggle('buy-item--disabled', !affordable);
    });
  }

  updateInventory(inventory, activeId) {
    const ownedIds = new Set((inventory || []).map((item) => item.id));
    this.buyItems.forEach((button, id) => {
      button.classList.toggle('buy-item--owned', ownedIds.has(id));
      button.classList.toggle('buy-item--equipped', id === activeId);
    });
  }

  updatePlayerStats(player) {
    if (!player) {
      return;
    }
    if (this.healthFill) {
      this.healthFill.style.width = `${player.health}%`;
      this.healthFill.style.background = player.health > 35 ? '#4caf50' : '#b71c1c';
    }
    if (this.healthValue) {
      this.healthValue.textContent = `${Math.max(0, Math.round(player.health))} HP`;
    }
    if (this.scoreDisplay) {
      this.scoreDisplay.textContent = player.score;
    }
  }

  setWeaponInfo(name, ammo, reserve) {
    if (this.weaponName) {
      this.weaponName.textContent = name || '—';
    }
    if (this.ammoDisplay) {
      if (ammo == null || reserve == null) {
        this.ammoDisplay.textContent = '—';
      } else {
        const ammoText = Number.isFinite(ammo) ? ammo : '∞';
        const reserveText = Number.isFinite(reserve) ? reserve : '∞';
        this.ammoDisplay.textContent = `${ammoText} / ${reserveText}`;
      }
    }
  }

  setWallet(value) {
    if (this.walletDisplay) {
      this.walletDisplay.textContent = `$${value}`;
    }
  }

  setReloadIndicator(visible, message = 'Перезарядка…') {
    if (!this.reloadIndicator) {
      return;
    }
    if (visible) {
      this.reloadIndicator.textContent = message;
      this.reloadIndicator.classList.remove('hidden');
    } else {
      this.reloadIndicator.classList.add('hidden');
    }
  }

  toggleStartPrompt(show) {
    if (!this.startPrompt) {
      return;
    }
    this.startPrompt.classList.toggle('hidden', !show);
    if (this.overlay) {
      this.overlay.style.pointerEvents = show || this.buyMenuOpen ? 'auto' : 'none';
    }
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
    const hasData = Boolean(stats && (stats.ping != null || stats.tickRate != null));
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
    if (items.length > 7) {
      items[0].remove();
    }
    setTimeout(() => entry.remove(), 8000);
  }
}
