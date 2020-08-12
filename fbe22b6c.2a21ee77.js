(window.webpackJsonp=window.webpackJsonp||[]).push([[52],{116:function(e,t,r){"use strict";r.r(t),r.d(t,"frontMatter",(function(){return o})),r.d(t,"metadata",(function(){return s})),r.d(t,"rightToc",(function(){return c})),r.d(t,"default",(function(){return p}));var n=r(2),a=r(6),i=(r(0),r(123)),o={id:"guide-dynamic-styles",title:"Dynamically Changing Styles Using JavaScript",sidebar_label:"Dynamic Styles"},s={id:"guide-dynamic-styles",isDocsHomePage:!1,title:"Dynamically Changing Styles Using JavaScript",description:"While Paperclip can cover most of your UI, there will probably be edge cases where you need to compute styles using code. Here's an example Paperclip file:",source:"@site/docs/guide-dynamic-styles.md",permalink:"/docs/guide-dynamic-styles",editUrl:"https://github.com/crcn/paperclip/edit/master/packages/paperclip-website/docs/guide-dynamic-styles.md",sidebar_label:"Dynamic Styles",sidebar:"docs",previous:{title:"Using Third-party Libraries",permalink:"/docs/guide-third-party-libraries"},next:{title:"Writing Paperclip Modules",permalink:"/docs/guide-modules"}},c=[],l={rightToc:c};function p(e){var t=e.components,r=Object(a.a)(e,["components"]);return Object(i.b)("wrapper",Object(n.a)({},l,r,{components:t,mdxType:"MDXLayout"}),Object(i.b)("p",null,"While Paperclip can cover ",Object(i.b)("em",{parentName:"p"},"most")," of your UI, there will probably be edge cases where you need to compute styles using code. Here's an example Paperclip file:"),Object(i.b)("pre",null,Object(i.b)("code",Object(n.a)({parentName:"pre"},{className:"language-html",metastring:"live",live:!0}),'<style>\n  .progress {\n    .bar {\n      background: linear-gradient(to right, #F60, #00CC00);\n      border-radius: 99px;\n      height: 3px;\n      box-sizing: border-box;\n      transition: 1s ease-out;\n    }\n    margin: 4px;\n    box-sizing: border-box;\n  }\n</style>\n\n\x3c!-- {style} must be explicity defined for it to be assignable to this element --\x3e\n<div export component as="Progress" class="progress">\n  <div class="bar" style={barStyle} />\n</div>\n\n\x3c!-- previews --\x3e\n\n<Progress barStyle="width: 50%" />\n<Progress barStyle="width: 75%" />\n<Progress barStyle="width: 100%" />\n')),Object(i.b)("blockquote",null,Object(i.b)("p",{parentName:"blockquote"},"This code can actually be done purely in CSS, but we'll just use it for this demo anyways. ")),Object(i.b)("p",null,"In JavaScript, we can simply add styles like so:"),Object(i.b)("pre",null,Object(i.b)("code",Object(n.a)({parentName:"pre"},{className:"language-typescript"}),'import {Progress} from "./progress.pc";\n\n<Progress barStyle={{ width: `${progress}%` }} />\n')),Object(i.b)("p",null,"That's just about it. Just pass a ",Object(i.b)("inlineCode",{parentName:"p"},"style")," attribute to Paperclip whenever you need to do styling in JavaScript. And be sure to expose ",Object(i.b)("inlineCode",{parentName:"p"},"{style?}")," in Paperclip, otherwise it won't work. If you need to stylize nested elements, you can do this:"),Object(i.b)("pre",null,Object(i.b)("code",Object(n.a)({parentName:"pre"},{className:"language-html"}),'<div export component as="Something">\n  <div style={myNestedStyle}>\n  </div>\n</div>\n')))}p.isMDXComponent=!0},123:function(e,t,r){"use strict";r.d(t,"a",(function(){return u})),r.d(t,"b",(function(){return y}));var n=r(0),a=r.n(n);function i(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function s(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){i(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function c(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var l=a.a.createContext({}),p=function(e){var t=a.a.useContext(l),r=t;return e&&(r="function"==typeof e?e(t):s(s({},t),e)),r},u=function(e){var t=p(e.components);return a.a.createElement(l.Provider,{value:t},e.children)},b={inlineCode:"code",wrapper:function(e){var t=e.children;return a.a.createElement(a.a.Fragment,{},t)}},d=a.a.forwardRef((function(e,t){var r=e.components,n=e.mdxType,i=e.originalType,o=e.parentName,l=c(e,["components","mdxType","originalType","parentName"]),u=p(r),d=n,y=u["".concat(o,".").concat(d)]||u[d]||b[d]||i;return r?a.a.createElement(y,s(s({ref:t},l),{},{components:r})):a.a.createElement(y,s({ref:t},l))}));function y(e,t){var r=arguments,n=t&&t.mdxType;if("string"==typeof e||n){var i=r.length,o=new Array(i);o[0]=d;var s={};for(var c in t)hasOwnProperty.call(t,c)&&(s[c]=t[c]);s.originalType=e,s.mdxType="string"==typeof e?e:n,o[1]=s;for(var l=2;l<i;l++)o[l]=r[l];return a.a.createElement.apply(null,o)}return a.a.createElement.apply(null,r)}d.displayName="MDXCreateElement"}}]);