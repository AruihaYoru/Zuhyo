// js/addon.js
/**
 * 図描 (Zuhyo) Addon System
 * 外部ファイルのインポート/エクスポートとプラグイン登録API
 */
window.ZuhyoAddonAPI = {
  addons: [],
  customCommands: [],
  
  register: function(addonDef) {
    console.log("Loading addon:", addonDef.name);
    this.addons.push(addonDef);
    
    if (addonDef.commands) {
      addonDef.commands.forEach(function(cmd) {
        window.ZuhyoAddonAPI.customCommands.push(cmd);
      });
    }
    
    if (addonDef.structures && typeof window.addStructureRaw === 'function') {
      addonDef.structures.forEach(function(s) {
         window.addStructureRaw(s.name, s.code);
      });
    }
    
    if (addonDef.onLoad) {
      addonDef.onLoad();
    }
    
    // 再描画をトリガーしてUIを更新
    if (window.renderer && window.proj) {
       window.renderer.updateProject(window.proj());
    }
    if (window.renderStructList) {
       window.renderStructList();
    }
  },

  importFromFile: function(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var content = e.target.result;
      if (file.name.endsWith('.js')) {
        try {
          var script = document.createElement('script');
          script.textContent = content;
          document.body.appendChild(script);
        } catch(err) {
          alert('アドオンJSの実行に失敗しました: ' + err.message);
        }
      } else if (file.name.endsWith('.zya') || file.name.endsWith('.json')) {
        try {
          var def = JSON.parse(content);
          window.ZuhyoAddonAPI.register(def);
        } catch(err) {
          alert('アドオンJSONの解析に失敗しました: ' + err.message);
        }
      }
    };
    reader.readAsText(file);
  },
  
  exportSelectedAsAddon: function(structId, defaultName) {
    if (!structId) {
      alert("エクスポートする構造が選択されていません");
      return;
    }
    var s = window.getStruct ? window.getStruct(structId) : null;
    if (!s) return;

    var def = {
      name: defaultName || (s.name + " Addon"),
      version: "1.0",
      description: "Zuhyo exported addon",
      type: "structures",
      structures: [ { name: s.name, code: s.code } ]
    };
    
    var blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (s.name.replace(/\s+/g, '_')) + '.zya';
    a.click();
    URL.revokeObjectURL(url);
  }
};
