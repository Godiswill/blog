# 常见布局
[原文链接](https://github.com/Godiswill/blog/issues/21)

设置背景样式，便于观察。
```css
.left {
  background-color: red;
}
.right {
  background-color: green;
}
.middle {
  background-color: palegreen;
}
```

## 两栏布局
左列定宽，右列自适应
### float
```html
<div class="two-col-float">
    <div class="left">left</div>
    <div class="right">right</div>
</div>
```

思路：左边定宽、float 脱离普通文档流，右边 margin-left 左边宽度
```css
.two-col-float .left {
  width: 200px;
  float: left;
}
.two-col-float .right {
  margin-left: 200px;
}
```

### position
```html
<div class="two-col-position">
    <div class="left">left</div>
    <div class="right">right</div>
</div>
```

思路：外层相对定位，左边绝对定位脱离普通文档流，右边 margin-left 左边宽度
```css
.two-col-position {
  position: relative;
}
.two-col-position .left {
  position: absolute;
  width: 200px;
}
.two-col-position .right {
  margin-left: 200px;
}
```
### flex
```html
<div class="two-col-flex">
    <div class="left">left</div>
    <div class="right">right</div>
</div>
```

思路：利用 flex 属性扩张、收缩、设置宽度的能力
```css
.two-col-flex {
  display: flex;
}
.two-col-flex .left {
  /*width: 200px;*/
  flex: 0 0 200px;
}
.two-col-flex .right {
  flex: auto;
}
```
## 三栏布局
左、右列定宽，中间自适应

### float
```html
<div class="tree-col-float">
    <div class="left">left</div>
    <div class="right">right</div>
    <div class="middle">middle</div>
</div>
```

思路：左右定宽浮动脱离普通文档流，中间左右 margin。注意html中 middle 在最下面
```css
.tree-col-float .left {
  float: left;
  width: 200px;
}
.tree-col-float .right {
  float: right;
  width: 100px;
}
.tree-col-float .middle {
  margin-left: 200px;
  margin-right: 100px;
}
```
### position
```html
<div class="tree-col-position">
    <div class="left">left</div>
    <div class="right">right</div>
    <div class="middle">middle</div>
</div>
```

思路：外层相对定位，左右定宽绝对定位脱离普通文档流，中间左右 margin。注意html中 middle 在最下面
```css
.tree-col-position {
  position: relative;
}
.tree-col-position .left {
  position: absolute;
  width: 100px;
}
.tree-col-position .right {
  position: absolute;
  width: 200px;
  right: 0;
}
.tree-col-position .middle {
  margin-left: 100px;
  margin-right: 200px;
}
```
### flex
```html
<div class="tree-col-flex">
    <div class="left">left</div>
    <div class="middle">middle</div>
    <div class="right">right</div>
</div>
```

思路：左右设为不能扩张、收缩，定宽。中间自动缩放
```css
.tree-col-flex {
  display: flex;
}
.tree-col-flex .left {
  flex: 0 0 200px;
}
.tree-col-flex .middle {
  flex: auto;
}
.tree-col-flex .right {
  flex: 0 0 100px;
}

```
## 三栏布局：中间优先
圣杯、双飞翼都属于三栏布局的范畴，不过要求中间的主元素 DOM 优先渲染。

### 圣杯
```html
<div class="holy-grail">
    <div class="container">
        <div class="middle">middle</div>
        <div class="left">left</div>
        <div class="right">right</div>
    </div>
</div>
```

思路：html 结构要求包裹一层container，整体 margin 出左右的空间，再利用浮动和负margin 和定位来确定左右的位置。
1. container margin 左右的宽度
1. 设置 middle、left、right浮动
1. middle 宽度 100%，left、right 定宽
1. left margin-left: -100%
1. left 相对定位负 left 自己宽度
1. right 负 margin-right 自己宽度（想象一下，假如不是有换行，right 应该在 container 右侧内，负margin-right 才能进到 container margin-right里面）
1. 设置外层最小宽度：left宽度 + right宽度 + left 相对定位溢出的宽度，即 2*left宽度 + right宽度

```css
.holy-grail .container {
  margin-left: 150px;
  margin-right: 200px;
}
.holy-grail .middle {
  float: left;
  width: 100%;
}
.holy-grail .left {
  float: left;
  width: 150px;
  margin-left: -100%;
  position: relative;
  left: -150px;
}
.holy-grail .right {
  float: left;
  width: 200px;
  margin-right: -200px;
}
.holy-grail {
  min-width: 500px;
}
```
### 双飞翼
```html
<div class="double-wings">
    <div class="container">
        <div class="middle">middle</div>
    </div>
    <div class="left">left</div>
    <div class="right">right</div>
</div>
```

思路：middle 被 container 包裹，container 浮动且 width:100% , middle margin 左右确定两边宽度。不包一层会导致宽度 100% 且带 margin 撑破父级宽度。
1. container、left、right 浮动定宽，container 为 100%，left、right 为固定宽度
1. middle margin 两边位置
1. left margin-left: -100% 上一行
1. right 负margin-left 自身宽度（想象一下，假如不是有换行，right 应该在 container 右侧外屏幕外，负margin-left 才能进到 middle margin-right里面）
1. double-wings 确定最小宽度 left + right
```css
.double-wings .container {
  float: left;
  width: 100%;
}
.double-wings .middle {
  margin-left: 200px;
  margin-right: 150px;
}
.double-wings .left {
  float: left;
  width: 200px;
  margin-left: -100%;
}
.double-wings .right {
  float: left;
  width: 150px;
  margin-left: -150px;
}
.double-wings {
  min-width: 350px;
}
```
### 圣杯 flex 版
```html
<div class="holy-grail-flex">
    <div class="container">
        <div class="middle">middle</div>
        <div class="left">left</div>
        <div class="right">right</div>
    </div>
</div>
```

思路：flex 天生就是用来解决此类布局的，利用 order 排序，而且自带等高。
```css
.holy-grail-flex .container {
  display: flex;
}
.holy-grail-flex .middle {
  flex: auto;
}
.holy-grail-flex .left {
  flex: 0 0 200px;
  order: -1;
}
.holy-grail-flex .right {
  flex: 0 0 100px;
}
```
