# Web 客户端模块边界

`web/app.js` 是装配入口，只负责页面生命周期、应用状态和用户命令编排。具体职责按下面的目录下沉：

- `config/`：稳定常量、素材表和显示模式。
- `domain/`：不读写 DOM、网络或浏览器存储的纯业务规则。
- `infrastructure/`：题包请求、公开资源路径和浏览器存储适配。
- `presentation/`：只根据输入生成或更新 DOM，不直接修改应用状态。
- `controllers/`：管理拖动、长按、计时器等有生命周期的交互，并通过注入的回调提交状态变化。

## 依赖方向

```text
app.js
  -> controllers -> domain, config
  -> presentation -> domain, infrastructure, config
  -> infrastructure -> config
  -> domain
```

约束：

1. `domain/` 不依赖 `presentation/`、`controllers/` 或 `infrastructure/`。
2. `infrastructure/` 不依赖 `presentation/` 或 `controllers/`。
3. `presentation/` 只读取传入状态，通过回调报告交互，不直接写应用状态。
4. `controllers/` 不直接渲染页面；它只持有拖动、长按等短生命周期状态。
5. 对外兼容 API 仍由 `web/app.js` 重新导出，现有调用方无需知道内部目录结构。
