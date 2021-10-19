# Extensions for Draw.IO
## LIVE PLUGIN

Live is a plugin extension for Draw.IO / Diagram.net allowing to update separately each node of a graph using REST API. Configuration is made using a custom panel "Live" in application's Format Panel.

### Getting started

#### Enable module

1. Start Draw-IO at https://app.diagrams.net/
2. Load plugins section using menu "Extras", sub-menu "Plugins"
3. Select "Add..." to add plugin
4. Then select "Custom..." to add non distributed plugins
5. Enter URL :
  * Self hosting URL to live.js
  * Or Zenetys hosted URL at https://draw.zenetys.com/plugins/live.js
6. Reload (Ctrl+R) IHM and have fun ! (two new button should appear in action bar).

#### First dynamic graph

1. Add a rounded rectangle to you graph
2. Using page "Live" tab, you can register your API or use sample one :
  * select "Diagram/API" text zone
  * enter your API (ex: https://ping.zenetys.com/api), validate
  * select "Diagram/Refresh" text zone
  * enter 5 (for 5 seconds), validate
3. Select object (Rounded Rectangle)
4. Using object "Live" tab, you can change attributs for this object :
  * select "Object" attribut
  * enter your API request (ex: `/obj1`), validate
  * select "Text" attribut
  * enter a javascript function that return text, for javascrpt code, begin the text with equal character (`=`), returned object name is `self`  (ex: `={return self.color.name;}`)
  * in "Add Live Property", change advanced properties of objects
    * in Property Name, enter `fillColor`
    * in Property Value, enter `={return self.color.name;}`
5. Don't forget to save your diagram
6. Start play with Update button (🔄) or with Play button (⏺︎).


