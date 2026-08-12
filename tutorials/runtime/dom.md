## DOM

> 如果想更加细致地了解 Web API，可以查阅 [MDN - Web AP](https://developer.mozilla.org/zh-CN/docs/Web/API) 。

DOM（Document Object Model）是浏览器提供的一套标准，用于将 HTML、XML、SVG 等文档解析为**对象化的树形结构**。浏览器加载页面时，会先解析 HTML 文档，然后根据标签层级创建一棵由节点组成的 DOM 树。Javascript 可以通过 DOM API 访问和操作这棵树，从而实现对文档内容的「增删改查」以及「事件监听」。

### 1. Inheritance

`Node` 是 DOM 树中所有节点的基类，所有 DOM 对象都最终继承自 `Node`，而 `Node` 又继承自 `EventTarget`。

```
EventTarget
 └─ Node
     ├─ Document
     ├─ CharacterData
     │   ├─ Text
     │   └─ Comment
     ├─ DocumentFragment
     └─ Element
         ├─ HTMLElement
         │   ├─ HTMLDivElement
         │   ├─ HTMLInputElement
         │   └─ ...
         ├─ SVGElement
         └─ MathMLElement
```

其中：

- `EventTarget` 是 DOM 事件系统的基础，所有能够监听事件的对象都继承自它——不只是 `Element`，`Document`、`window`、`XMLHttpRequest` 等同样基于` EventTarget` 获得事件能力。

- `Node` 是 DOM 树中所有节点的抽象基类，常见 Node 类型有：

  |         节点类型 | nodeType | 示例               |
  | ---------------: | -------- | ------------------ |
  |         Document | 9        | `document`         |
  |          Element | 1        | `<div>`            |
  |             Text | 3        | 文本内容           |
  |          Comment | 8        | `<!-- comment -->` |
  | DocumentFragment | 11       | 文档片段           |

- `Element` 是 `Node` 的一种特殊类型，用于表示 HTML/XML/SVG 标签节点。可以说 `Node` 更关注树状关系，而 `Element` 则提供更多对标签的操作能力。

### 2. NodeList & HTMLCollection

在 DOM API 中，经常会返回节点集合。有两种表示集合的类型：

- `NodeList` 表示一组 Node 节点，可以通过 `node.childNodes` / `document.querySelectorAll` 获取该类型的节点集合。
- `HTMLCollection` 则表示一组 Element 节点，可以通过 `element.children` / `document.getElementsByTagName` 等方法获取。此类型是旧 Web API，需要转换为 JS 集合后才能使用 `forEach` 迭代。

`querySelectorAll` 和 `getElementsBy*` 的使用不当经常会导致代码出现问题。`querySelectorAll` 返回的是**静态**列表，而 `getElementsBy*` 返回的列表会随着 DOM 树的变化而变化。
