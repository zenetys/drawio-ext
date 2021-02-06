# LIVE PLUGIN

Extensions for Draw.IO / Diagram.net allowing to update separately each node of a graph & adding a custom panel in application's Format Panel.

## Getting started

Purpose: Add live attributes in meta data of the diagram & graph objects to turn its into live graph objects, capable of doing schedulded AJAX requests to update objects targetted.

To handle live update plugin state, use the buttons located in interface toolbar:

- ⏺︎ (Play) : Starts the plugin feature.
- ⏸ (Pause) : Stops the feature.
- 🔄 (Restart) : Updates graph live elements list & starts the feature.

Each graph node is updated depending on resfresh delay & data stored in diagram & graph nodes live attributes.  
If plugin is running on a page & you switch to another, plugin autostops.

### Difference between Play & Restart

When played for first time, plugin stores the ids of all current graph live elements, to not have to fetch them each time there is an update.  
When Pause is clicked, live update feature is disabled but the stored ids stay, then id storage is not done when you click on Play.

If the graph changes during the pause with live elements added or removed, you should click on Restart to perform the ids storage in the current graph & avoid troubles.

## API responses

Plugin enables the feature to perform an AJAX request to fetch values from distant APIs.

Requested API response can be:

- **Simple response**: Received response is a simple string corresponding to the expected value which is used to update graph element, depending on url set in the corresponding live attribute
- **Complex response**: Received response is an object in which some graph objects can fetch values. In this case, specific live attributes have to be set & live attributes value are JS instructions to get the value from the object returned by the AJAX request

## Live attributes

Use live attributes in the meta data of the diagram & the targetted graph objects to configure the plugin's behavior.  
There are 2 types of live attributes: **root attributes** stored in the meta data of the diagram & **objects attributes** stored in graph objects data.

## Root live attributes

Root live attributes are attributes stored in the meta data of the diagram. Attributes have to be stored in the diagram node with id equals to "0".  
Some root attributes can be used in graph object & thus are more hybrid attributes than only root ones.

- **live.refresh**
  - Interval between 2 updates, set in seconds
  - Optional. If not set, default value is 10s
- **live.api**
  - Url to request the distant API
  - Can be used as prefix for graph objects urls
  - If set in a graph object, overrides root value for the object
- Credentials:
  - **live.username**
    - Username value to perform an authentication to the api
    - Optional. If not set, assuming that api does not need credentials
  - **live.apikey**
    - Apikey value to perform an authentication to the api
    - Optional. If not set, assuming that api does not need credentials
  - **live.password**
    - Password value to perform an authentication to the api
    - Optional. If not set, assuming that api does not need credentials
    - If set, **live.password** is prior than **live.apikey**
  - Credential attributes priority: If set in a graph object, root credential attributes are used *if object attributes extend root **live.api*** value, else object credential attributes are used
- **live.source**
  - In case of an API returning *complex responses*, path to access exploitable data from the object received by the request
  - Useless if **live.apitype** is set or in only *simples responses API* case
  - If not set, full response is used
- **live.apitype**
  - Allows to set a stored **live.source** depending on identifier set in this attribute
  - Overrites **live.source**
  - If set in a graph object, root attribute is used *if object **live.data** extends root **live.api*** value, else object attribute is used
  - Default value is `raw` where live.source has to be explicitely

### Objects live attributes

Objects live attributes are stored in graph object data accessible by `right click > "Edit Data"` or shortcut `CTRL + M`

- **live.data**
  - Url to fetch data from an API returning complex response
  - Required in each object using complex responses
  - If set, remember to use **live.source** or **live.apitype** to get exploitable data from the received response
  - Value: Url can be absolute or relative. If relative:
    - Starts with "**/**"
    - Extends **live.api** value if attribute is set for the selected object
    - Else extends root **live.api** attribute

Next object attributes match the same behavior & particularities:

- **live.style**: Allows to update full object style
- **live.text**: Allows to update text displayed by the object
- **live.property.\<NAME>** (*live properties*)
  - Allows to update properties of a graph element identified by \<NAME>
  - Can be set for each selected graph property
  - Example: you can set `live.property.fillColor` which updates graph element's *Fill Color* property & `live.property.strokeColor` to update *Stroke Color* property

Attributes for each of these live attributes can be

- A string corresponding to the url where fetch *simple API response*
  - Url can be absolute or relative
  - If relative:
    - Starts with **`/`**
    - Value stored in attribute extends object **live.api** is attribute is set or root **live.api** attribute value
  - Examples of values:
    - `/text` relative value extending **live.api** value stored in object or root
    - `https//www.api.com/foo` absolute value containing full url to request API
- A set of JavaScript instructions in the case of a *complex API response*
  - **live.data** has to be set to request a *complex API* & fetch the object in which get values
  - Value starts with **`=`** to target instructions wrapped in **`{...instructions}`**
  - Instructions:
    - Allows to fetch or compute the returning value from received exploitable data
    - Use `data` to reference exploitable data object fetched from API response
    - Must return something, otherwise no value is used to update corresponding case
  - Example of values:
    - `={return data.localization;}` returns value of `localization` property stored in exploitable data
    - `={return data.load > 80 ? data.colors.overload : data.colors.loadOk;}` returns a value stored in exploitable data depending on other stored value
    - `{=data.average}` doesn't return anything even if average is a property of the received object because nothing is returned

## Live Format Panel

The plugin allows to manage a custom tab in the application's Format Panel.  
Live tab displays data corresponding to Live plugin operation & gives a conveninent way to handle live attributes by adding, editing or removing its from selected object in the graph.  
If no object is selected, custom tab displays root live attributes.  
If a graph object is selected, custom tab handles attributes stored in this object.
