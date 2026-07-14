# 职业规划 · 在线自评表单（GitHub Pages 托管）

本仓库是「职业规划师专家包」自评表单的静态托管源。表单为**完全自包含的单文件 HTML**，无后端、无构建步骤，可直接由 GitHub Pages 托管。

- **在线地址**：GitHub Pages 启用后形如 `https://<用户名>.github.io/<仓库名>/`（永久稳定，改版不变）
- **托管文件**：本仓库根目录 `index.html`
- **专家包本体**：`C:\Users\Admin\.workbuddy\plugins\marketplaces\my-experts\plugins\career-planner\`
- **当前版本**：v1.17.0（荣格八维 / Holland RIASEC / 工作价值观 / 约束硬过滤 / 大五可选轴 / AI 适应力可选轴 / 简历实证层 / 自包含 HTML 报告导出）

## 更新流程
修改源表单后，将最新 `index.html` 复制到此仓库根目录，然后：
```bash
git add -A && git commit -m "update form" && git push
```
GitHub Pages 会自动生效，**链接保持不变**。

> 说明：`.nojekyll` 用于禁止 GitHub 的 Jekyll 处理（本页纯静态，无需它）。
