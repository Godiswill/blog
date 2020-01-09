# JS面向对象
[原文链接](https://github.com/Godiswill/blog/issues/8)

面向对象就是描述一种代码组织的形式，用来构建真实世界物体或概念的建模方式。
它主要的概念包括封装、继承、多态等。

## 封装

把一些数据或数据结构和操作数据结构的方法抽象在一个模板(类)中。
由类生成的实例对象暴露出一些数据和方法给外部使用。

现实中的物体或概念往往可以找出有一些共同的特征。
例如你可以简单的将有两个眼睛、一张嘴等器官且会说话动物的称为正常人类。
眼睛、嘴等器官就是人类的属性，而说话就是人类的功能之一。

往往需要给嘴等重要器官加访问控制权限，谁都不希望嘴被外部无故改成屁股吧，例如
public、protect、private等声明。
说话功能可能实现起来非常复杂，需要大脑神经、声带、口腔、嘴等器官一系列的配合，
这复杂的子功能和相互协调的实现无需暴露给外部，而仅仅暴露一个方法接收说话的内容。

JS原生并不支持public、protect、private，私有变量一般由闭包来实现。

```javascript
const people = (function() {
  const  words = 'hello world'; // 私有（private）变量
  
  return {
    speck: function() { // 公开（public）方法
      return words;
    }
  }
})();
console.log( people.speck() ); // 输出：match
console.log( people.words );   // 输出：undefined
```

## 继承

辛辛苦苦封装好了当了是为了更好的组合和复用了。面向对象的世界说起继承一般是类与类的扩展关系。
JS并没有类的概念，最新的`class`也不过是基于原型链继承的语法糖。

依旧举人类的例子，随着社会分工，人类也分了很多工种，能干的活儿就不一样了。
单作为一个正常人的基本属性和复杂功能已经抽象定义好了，你就不用再为复杂的人类烦恼了：

```javascript
class Person {
  #mouth = '嘴巴';
  speack() {}
}
```

例如一个程序员，我们只要把程序员的基本功能抽象出来就好了，例如程序员会写代码：

```javascript
class Programmer extends Person {
  coding() {}
}

// 老王
const wang = new Programmer();
// 老王作为一个人会说话
wang.speack();
// 老王最为程序员会写代码
wang.coding();
```
## 多态

在面向对象中多态一般分为编译时多态和运行时多态。

- 编译时多态

例如 `java`，类中可以定义多个同名方法，而不会被覆盖。根据传入的参数和参数个数的不同，编辑阶段就能确定实际调用的那个方法。
```java
class X {
    public void show(Y y){
        System.out.println("x and y");
    }
    public void show(){
        System.out.println("only x");
    }
}
 
class Y extends X {
    public void show(Y y) { // 复写X的方法
        System.out.println("y and y");
    }
    public void show(int i) {
 
    }
}
 
class main{
    public static void main(String[] args) {
        X x = new Y();
        x.show(new Y()); // Y 中实现的方法
        x.show(); 			 // X 中继承的方法
    }
}
//结果
//y and y
//only x
```

- 运行时多态

例如 `java`，猫狗都有动物吃的功能，但一个爱出鱼，一个爱吃骨头。
但猫和狗本质还是动物，猫狗的实例对象都能赋值给动物，但在编译阶段，并不知道改调用猫的还是狗的。
只有在运行阶段才知道原来刚开始是猫吃鱼，然后是只狗爱吃骨头。

```java
public class Animal {
    public void eat(){
        System.out.println("animal eatting...");
    }
}
 
public class Cat extends Animal{
    public void eat(){
        System.out.println("我吃鱼");
    }
}
 
public class Dog extends Animal{
    public void eat(){
        System.out.println("我吃骨头");
    }
}
 
public class Main {
    public static void main(String[] args) {
        Animal animal = new Cat(); //向上转型
        animal.eat();
       
        animal = new Dog();
        animal.eat();
    }
}
//结果:
//我吃鱼
//我吃骨头
```

多态本质上是为了避免在一个方法里判断参数的类型和个数来实现不同的功能的一种策略模式。

很明显JS原生不支持。也可以说JS天生支持多态。因为你传多少个参数什么类型的参数，编译器并不关心。
只是你要自己实现根据参数来切换不同功能的分支。

JS是基于原型链继承的，例如：

```javascript
class A {}
const a = new A();
a.toString(); // 调用 Object.prototype.toString
```

一般对象都继承于 `Object` ，你可以为全局修改 `Object.prototype.toString` 的实现方式。
也可以在 A 的原型上实现 `toString` 方法。例如：

```javascript
class A {}
A.prototype.toString = function() { console.log('A'); }
const a = new A();
a.toString(); // 调用 A.prototype.toString
```

等价于

```javascript
class A {
  toString() {
     console.log('A');
  }
}
const a = new A();
a.toString(); // 调用 A.prototype.toString
```

## 高内聚低耦合

所谓高内聚就是几个相关性很强的小对象聚合成一个新对象。

例如人的大脑，我们可以把它大致拆分如前后左右中5个区块，假如前块控制眼睛、嘴巴，后块控制双脚等。
一个复杂的大脑就被我们拆分成不那么复杂的小块，便于各个击破，逐一实现、维护。
5个区块相互协调组起来就成了一个完整的大脑。

只有前块控制眼睛看物体、眨眼睛，不归别的区块管，其他也管不了。我们就能说前块与眼睛看物体、眨眼睛是高内聚的。
而5个区块构成一个大脑，少一块不是大脑，多一块冗余。

彼此也不用在意对方区块控制功能具体实现细节，通过封装只需要暴露通信的方式，由整个大脑实现眼睛往前看，
腿往后倒退的行为。前块不需要知道也不依赖后块的走是如何实现的，即使看物体的实现方式改变了，改变内部结构，也不影响之前大脑的整体协调，我们可以说区块之间耦合松散或低耦合。

## 参考

1. [javascript面向对象系列第四篇——OOP中的常见概念](https://www.cnblogs.com/xiaohuochai/p/7896586.html)
1. [Java中的多态](https://www.runoob.com/w3cnote/java-polymorphism.html)
