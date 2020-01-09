# 块级格式化上下文BFC
[原文链接](https://github.com/Godiswill/blog/issues/8)

`BFC——block formatting context` 即块级格式化上下文，该区块是 `CSS` 盒模型布局的区域。
常规的普通流、浮动流、定位元素等交互就发生在该区域。

什么意思呢？

也就是说常见的布局规则一般遵循在同一 `BFC` 中。

比如说元素设置浮动 `float: left`，就形成一个 `BFC`，它与其他元素就不再遵循普通流的规则。

在浮动元素内部的元素依然被包裹在该元素内部且随着它一起浮动。

常见造成元素 `BFC` 原因

1. 根元素(html)
1. 浮动元素（元素的 float 不是 none）
1. 绝对定位元素（元素的 position 为 absolute 或 fixed）
1. 行内块元素（元素的 display 为 inline-block）
1. 表格单元格（元素的 display为 table-cell，HTML表格单元格默认为该值）
1. 表格标题（元素的 display 为 table-caption，HTML表格标题默认为该值）
1. 匿名表格单元格元素（元素的 display为 table 或 inline-table）
1. overflow 值不为 visible 的块元素
1. display 值为 flow-root 的元素
1. 弹性元素（display为 flex 或 inline-flex元素的直接子元素）
1. 网格元素（display为 grid 或 inline-grid 元素的直接子元素）
1. 等

`BFC` 一般能解决两个的问题：
1. 清除浮动
1. 避免外边距合并

- 清除浮动（解决浮动塌陷）

```css
.box {
    background-color: rgb(224, 206, 247);
    border: 5px solid rebeccapurple;
}
.float {
    float: left;
    width: 200px;
    height: 150px;
    background-color: white;
    border:1px solid black;
    padding: 10px;
}     
```

```html
<div class="box">
    <div class="float">I am a floated box!</div>
    <p>I am content inside the container.</p>
</div>
```

`div.float` 由于高度较高且浮动脱离普通文档流。 `div.box` 高度由 `p` 的高度决定。
导致 `div.float` 有撑破 `div.box` 的感觉。

使 `div.box` `BFC` 一下，则子元素的普通流、浮动流都在该元素内部发生。

例如设置 `div.box` `overflow: hidden` 等就能达到效果。但类似 `overflow` 等的副作用较大。

耳熟能详的 hack 手段：`clearfix` 

```css
.clearfix::after { 
  content: "";
  display: block; 
  clear: both;
}
```

也有无副作用的草案标准 `display: flow-root` 来 `BFC` 清除浮动。

- 避免 `margin` 合并（其实不是很常用，可以改 padding 等手段解决）

```css
.blue, .red-inner {
  height: 50px;
  margin: 10px 0;
}

.blue {
  background: blue;
}

.red-outer {
  overflow: hidden;
  background: red;
}
```

```html
<div class="blue"></div>
<div class="red-outer">
  <div class="red-inner">red inner</div>
</div>
```

如果注释掉 `.red-outer` 的 `overflow: hidden;` 
你会发现 `div.red-inner` 的上外边距和父级兄弟元素 `div.blue` 的下外边距发生何并。

可以对 `div.red-outer` 来 `BFC` 形成一个新的独立区域来避免与外部元素发生外边距合并。

## 参考

1. [mozilla-BFC](https://developer.mozilla.org/en-US/docs/Web/Guide/CSS/Block_formatting_context)
