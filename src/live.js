/**
 * Live Update plugin.
 * 
 * Allows you to update separately each selected graph element.
 * Use live attributes to configure the plugin.
 * 
 * In the metadata of the diagram (graph element with id = 0)
 *    - live.api: url prefix to request the distant API (optional, see below).
 *    - live.refresh: interval between 2 updates, set in seconds (optional, 
 *      default is 10s).
 * 
 * In the graph objects properties (right click > "Edit Data" or 
 * CTRL+M):
 *    - live.data: calls a complex API (returning an object)
 *    - live.text: updates element text node.
 *    - live.style: updates element style.
 *    - live.property.<PROPERTY_NAME>: updates element <PROPERTY_NAME> value.
 *        Example: "live.property.fillOpacity" updates "Fill Opacity" element 
 *        property.
 * 
 * See documentation for more details.
 */
Draw.loadPlugin(
  function(ui) {
    const live = {
      thread: null,
      username: "live.username",
      apikey: "live.apikey",
      password: "live.password",
      api: "live.api",
      apitype: "live.apitype",
      refresh: "live.refresh",
      style: "live.style",
      text: "live.text",
      data: "live.data",
      source: "live.source",
      apitypes: [{
        id: "elastic",
        source: "hits.hits[0]._source"
      },{
        id: "hastat",
        post: hastatBuildObject
      }],
      property: {
        prefix: "live.property.",
        getName: (fullPropName) => fullPropName.slice(live.property.prefix.length)
      },
      nodes: [],
      timeout: 0,
      isInit: false,
      graphPageId: "",
      mxUtilsRequestErrorMsg: "{\"status\": \"error\"}",
      formatPanel: {
        arePropertiesShown: false,
        isDisplayed: false,
      }
    };

    /** Launches "Live" feature in webapp */
    function initPlugin() {
        // Extract from original plugin animation.js
        // https://github.com/jgraph/drawio/blob/master/src/main/webapp/plugins/animation.js
        // Adds resource for action
        mxResources.parse('animation=Animation...');

        // Adds action
        ui.actions.addAction('animation', function() {
            if (this.animationWindow == null) {
                // LATER: Check outline window for initial placement
                this.animationWindow = new AnimationWindow(ui, (document.body.offsetWidth - 480) / 2, 120, 640, 480);
                this.animationWindow.window.setVisible(true);
            }
            else {
                this.animationWindow.window.setVisible(!this.animationWindow.window.isVisible());
           }
        });

        // Autostart in chromeless mode
        if (ui.editor.isChromelessView()) {
            function startAnimation() {
                var root = ui.editor.graph.getModel().getRoot();
                var result = false;

                if (root.value != null && typeof(root.value) == 'object') {
                    var desc = root.value.getAttribute('animation');

                    if (desc != null) {
                        run(ui.editor.graph, desc.split('\n'), true);
                        result = true;
                    }
                }

                return result;
            } // startAnimation()

            // Wait for file to be loaded if no animation data is present
            if (!startAnimation()) {
                ui.editor.addListener('fileLoaded', restartScheduleUpdate);
            }
        }
        else {
            ui.format.showCloseButton = false;
            ui.editor.addListener("fileLoaded", function() {
                addLiveUpdatePalette();
                addLiveTabToFormatPanel();
                overrideFormatPanelRefresh();
            });
        }
    }

    /** Adds a new palette with buttons to handle the live feature state in the toolbar */
    function addLiveUpdatePalette() {
      if(!ui.toolbar) {
        log("Toolbar doesn't exist. Plugin is inactive...")
      }
      else {
        ui.toolbar.addSeparator();
        const buttons = [
          ["⏺︎","Start graph live update",startScheduleUpdate],
          ["⏸","Stop graph live update",pauseScheduleUpdate],
          ["🔄","Reload current graph & start live update",restartScheduleUpdate],
        ];

        for(const button of buttons) {
          const [label, tooltip, funct] = button;
          ui.toolbar.addMenuFunction(
            label,
            tooltip,
            true,
            funct,
            ui.toolbar.container
          );
        }
      }
    }

    /** Adds "Live" custom format tab in Format Panel */
    function addLiveTabToFormatPanel() {
      const formatContainer = document.querySelector(".geFormatContainer");
      const formatHeaders = formatContainer.firstChild;
      if(!formatHeaders) return;
      const formatWidth = parseInt(formatContainer.style.width);
      const headersNb = formatHeaders.childNodes.length;

      // Adds tab only if formatWidth > 0 === format panel is displayed
      if(formatWidth > 0) {
        const headerLength = parseInt(formatWidth / (headersNb + 1));
        for(const header of formatHeaders.children) {
          header.style.width = headerLength + "px";
        }

        /**
         * Sets Format Panel tab style, depending 
         * on if current tab is focused one or not
         * @param {HTMLElement} elt Format Panel tab
         * @param {boolean} isActiveTab True if selected tab is active one
         */
        function setTabStyle(elt, isActiveTab = false) {
          elt.style.backgroundColor = isActiveTab ? "inherit"
          : ui.format.inactiveTabBackgroundColor;
          elt.style.borderWidth = "0px";
          elt.style.borderLeftWidth = "1px";
          elt.style.borderBottomWidth = isActiveTab ? "0px" : "1px";
        }

        const liveHeader = formatHeaders.firstChild.cloneNode(false);
        liveHeader.style.width = headerLength;
        setTabStyle(liveHeader);
        mxUtils.write(liveHeader, "Live");
        formatHeaders.appendChild(liveHeader);

        /**
         * Listener called at "click" on format panel tabs  
         * Displays Live Format Panel if liveHeader is clicked
         * @param {HTMLElement} target Format Panel clicked tab
         */
        function handleLiveFormatPanelDisplay(target) {
          if(target === liveHeader) {
            // selected tab is Live => display Live Format Panel
            live.formatPanel.isDisplayed = true;
            liveContent.style.display = "block";
            formatContainer.appendChild(liveContent);
            
            for(const header of formatHeaders.children) {
              setTabStyle(header, header === liveHeader)
            }

            for(const content of formatContainer.childNodes) {
              if(content !== formatContainer.firstChild) {
                content.style.display = content === liveContent ? "block":"none";
              }
            }
          } else {
            // Hide Live panel & display selected one
            live.formatPanel.isDisplayed = false;
            setTabStyle(liveHeader)
            liveContent.style.display = "none";

            const childrenList = Array.from(formatContainer.firstChild.childNodes);
            if(childrenList) {
              const id = childrenList.findIndex(elt => elt === target)
              if(ui.format.panels[id]) {
                ui.format.panels[id].container.style.display = "block";
                setTabStyle(target, true);
              }
            }
          }
        }

        const liveContent = buildLiveFormatPanelContent();
        if(live.formatPanel.isDisplayed) {
          handleLiveFormatPanelDisplay(liveHeader);
        }

        mxEvent.addListener(formatHeaders, "click", function(e) {
          handleLiveFormatPanelDisplay(e.target);
        });
      }
    }

    /** Overrides format panel reshresh event to add Live tab */
    function overrideFormatPanelRefresh() {
      const formatRefreshBasicFunc = ui.format.refresh;
      ui.format.refresh = function() {
        mxUtils.bind(ui.format,formatRefreshBasicFunc)();
        if(!ui.editor.graph.isEditing()) addLiveTabToFormatPanel();
      }
    }

    /** Builds content in Live Format Panel */
    function buildLiveFormatPanelContent() {
      const graphXml = ui.editor.getGraphXml();
      const graph = ui.editor.graph;
      const liveFormatPanelContainer = document.createElement('section');
      const targetId = graph.isSelectionEmpty() ? "0"
      : graph.selectionModel.cells[0].getId();

      const baseAttributes = [
        ["API", live.api],
        ["API Type", live.apitype],
        ["Username", live.username],
        ["Password", live.password],
        ["API Key", live.apikey],
        ["Source", live.source],
        ["Refresh", live.refresh],
      ];
      const objectAttributes = [ 
        // Displayed only if a node is selected in the graph
        ["Object", live.data],
        ["Text", live.text],
        ["Style", live.style],
      ];

      /**
       * Builds an input section in the Live format panel
       * @param {string} text Displayed label
       * @param {string} attrName Input's corresponding live attribute
       * @param {string} targetId Targetted graph node id
       * @returns {object} Set of all HTML elements for the input
       */
      function buildInput(text, attrName, targetId) {
        const emptyValue = "";
        const target = mxUtils.findNode(graphXml, "id", targetId);
        const base = mxUtils.findNode(graphXml, "id", "0");
        const value = target.getAttribute(attrName) || null;

        const cb = document.createElement('input');
        cb.setAttribute('type', 'checkbox');
        cb.style.margin = '3px 3px 0px 0px';
        cb.checked = value;
        cb.title = (cb.checked ? "Remove":"Add") + " attribute";

        const label = document.createElement("label");
        mxUtils.write(label, text);
  
        const shortField = document.createElement('input');
        shortField.style.backgroundColor = "white";
        shortField.style.width = "60%";
        shortField.style.height = "20px";
        shortField.style.float = "right";
        shortField.type = "text";
        shortField.style.border = "1px solid " + ui.format.inactiveTabBackgroundColor;
        shortField.value = value;
        shortField.style.borderRadius = "0px";
        shortField.style.fontStyle = (value) ? "normal": "italic";
        
        /**
         * Computes placeholder for "source" live format panel input.
         * Checks depend on nodes **live.apitype** & **live.source** attributes
         * @param {Node} target Targetted graph node 
         * @param {Node} base Graph base node (with id=0)
         * @returns {string} Computed placeholder or default empty value
         */
        function getSourcePlaceholder(target, base) {
          /**
           * Computes source placeholder depending on 
           * checked node **live.apitype** attribute value
           * @param {Node} elt Current checked node
           */
          function checkApitype(elt) {
            if(elt.hasAttribute(live.apitype)) {
              const apiType = live.apitypes.find(
                (api) => (api.id === elt.getAttribute(live.apitype))
              );
              return apiType ? (
                `api ${apiType.id} => ${apiType.source ||"Function"}`
              ): false;
            } else return false;
          }
          return checkApitype(target) ? checkApitype(target)
          : checkApitype(base) ? checkApitype(base) 
          : base.hasAttribute(live.source) ? base.getAttribute(live.source)
          : emptyValue;
        }

        shortField.placeholder = (attrName === live.apitype) ? "raw"
        : (attrName === live.source) ? getSourcePlaceholder(target, base)
        : base.hasAttribute(attrName) ? base.getAttribute(attrName)
        : emptyValue;

        const longField = document.createElement("textarea");
        longField.rows = 5;
        longField.style.boxSizing = "border-box";
        longField.style.width = "100%";
        longField.style.padding = "0px";
        longField.style.margin = "0px";
        longField.style.backgroundColor = "white";
        longField.style.resize = "none";
        longField.style.border = "1px solid " + ui.format.inactiveTabBackgroundColor;
        longField.style.display = "none";
        longField.style.outline = "none";
        longField.style.borderRadius = "0px";
        longField.value = value;
        longField.placeholder = shortField.placeholder;
        longField.style.fontStyle = (value) ? "normal" : "italic";

        // INPUTS EVENT HANDLERS \\
        function handleKeyDownOnTextInput(e) {
          if(e.key === "Enter" || e.key === "Escape") {
            if(e.key === "Escape") {
              longField.value = value;
            }
            document.activeElement.blur();
          }
        }
        function handleFocusoutOfTextInput() {
          const initialValue = mxUtils.findNode(
            graphXml, 
            "id", 
            targetId
          ).getAttribute(attrName) || "";
          
          if(initialValue !== longField.value) {
            updateLiveAttrInFormatPanel(targetId, attrName, longField.value);
          }
          longField.style.display = "none";
          shortField.style.display = "inline";
        }
        function handleClickOnCheckbox(e) {
          e.preventDefault();
          const isChecked = !e.target.checked;
          if(isChecked) {
            if(mxUtils.confirm("Are you sure to remove " + attrName + " ?")) {
              updateLiveAttrInFormatPanel(targetId, attrName);
            }
          } else {
            shortField.focus();
          }
        }
        function handleFocusOnShortField(e) {
          e.preventDefault();
          shortField.style.display = "none";
          longField.style.display = "block";
          longField.focus();
        }

        mxEvent.addListener(cb, "click", handleClickOnCheckbox);
        mxEvent.addListener(shortField, "focus", handleFocusOnShortField);
        mxEvent.addListener(longField, "keydown", handleKeyDownOnTextInput);
        mxEvent.addListener(longField, "focusout", handleFocusoutOfTextInput);

        return {
          cb,
          label,
          longField,
          shortField,
        };
      }

      /**
       * Builds inputs then appends its to the Live format panel container
       * @param {Array<object>} inputsList List of data for the input build
       * @param {HTMLElement} container Inputs HTML container
       * @param {string} targetId Targetted graph node id
       */
      function handlePanelInputs(inputsList, container, targetId) {
        for(const input of inputsList) {
          const [text, attributeName] = input;

          const inputSection = document.createElement('section');
          inputSection.style.padding = '6px 0px 1px 1px';
          inputSection.style.whiteSpace = 'nowrap';
          inputSection.style.overflow = 'hidden';
          inputSection.style.fontWeight = "normal";
  
          const {cb, shortField, longField, label} = buildInput(
            text,
            attributeName,
            targetId
          );

          inputSection.append(cb, label, shortField, longField);
          container.appendChild(inputSection);
        }
      }

      /**
       * Builds a subpanel in the Live Format Panel
       * @param {string} title Subpanel title
       * @param {string} targetId Targetted graph node id
       * @param {array<objects>} baseInputs List of base live attributes data
       * @param {array<objects>} graphNodeInputs List of graph nodes attributes data
       * @returns The built subpanel
       */
      function buildSubpanel(title, targetId, baseInputs, graphNodeInputs) {
        const isGraphNodeSelected = targetId !== "0";
        const subpanelContainer = new BaseFormatPanel().createPanel();
        subpanelContainer.style.padding = "12px";
        const titleContainer = new BaseFormatPanel().createTitle(title);
        titleContainer.style.width = "100%";
        subpanelContainer.appendChild(titleContainer);

        handlePanelInputs(baseInputs, subpanelContainer, targetId);
        if(isGraphNodeSelected) {
          handlePanelInputs(graphNodeInputs, subpanelContainer, targetId);
        }
        return subpanelContainer;
      }

      liveFormatPanelContainer.appendChild(
        buildSubpanel(
          targetId === "0" ? "Diagram" : "Object " + targetId,
          targetId,
          baseAttributes,
          objectAttributes
        )
      );

      /**
       * Builds "Properties" section of the Live format panel 
       * @param {string} targetId Targetted graph object's id
       */
      function buildPropertiesSubpanel(targetId) {
        const target = mxUtils.findNode(graphXml, "id", targetId);

        const panelContainer = new BaseFormatPanel().createPanel();
        panelContainer.style.padding = "0 12px 0 0";
        const propertiesTable = document.createElement("table");
        propertiesTable.classList.add("geProperties");
        propertiesTable.style.whiteSpace = "nowrap";
        propertiesTable.style.width = "100%";
        propertiesTable.style.tableLayout = "fixed";
        propertiesTable.style.borderCollapse = "collapse";
        propertiesTable.style.backgroundClip = "padding-box";
        panelContainer.appendChild(propertiesTable);

        const tr = document.createElement("tr");
        tr.classList.add("gePropHeader");
        propertiesTable.appendChild(tr);
        
        const headerCells = [
          [" ", "15px"],
          ["Property", ""],
          ["Value", "calc(211px * .6)"],
        ];
        for(const headerCell of headerCells) {
          const th = document.createElement("th");
          th.classList.add("gePropHeaderCell");
          th.style.padding = "0";
          const [content, width] = headerCell;
          mxUtils.write(th, content);
          th.style.width = width;
          tr.appendChild(th);
        }

        for(const attribute of target.attributes) {
          if(attribute.name.startsWith(live.property.prefix)) {
            const newLine = document.createElement("tr");
            newLine.classList.add("gePropNonHeaderRow");


            const {cb, label, shortField, longField} = buildInput(
              live.property.getName(attribute.name), 
              attribute.name, 
              targetId
            );

            shortField.style.width = "100%";
            shortField.style.height = "20px";
            shortField.style.float = "left";
            shortField.style.boxSizing = "border-box";
            longField.style.border = "1px solid " + ui.format.inactiveTabBackgroundColor;
            longField.style.borderRadius = "0px";
            const cells = [
              cb, 
              label, 
              shortField
            ];
            cb.style.margin = "0";

            for(const cellContent of cells) {
              const td = document.createElement("td");
                td.style.textAlign = cellContent === cb ? "center" : "left";
                td.style.verticalAlign = "center";
                td.style.padding = "0";

              if(typeof cellContent === "string") {
                mxUtils.write(td, cellContent);
              } else {
                td.appendChild(cellContent);
              }
              newLine.appendChild(td);
            }

            const longFieldCell = document.createElement("th");
            longFieldCell.colSpan = "3";
            longFieldCell.style.paddingLeft = "12px";
            longFieldCell.appendChild(longField)

            propertiesTable.appendChild(newLine);
            propertiesTable.appendChild(longFieldCell);
          }
        }
        return panelContainer;
      }

      /**
       * Builds the "Add new property" form in the Live format panel 
       * @param {string} targetId Targetted graph object's id
       */
      function buildNewPropertyForm(targetId) {
        const formContainer = new BaseFormatPanel().createPanel();
        const title = new BaseFormatPanel().createTitle("Add Property");
        formContainer.appendChild(title);
        formContainer.style.padding = "12px";
        formContainer.style.textAlign = "center";
        const inputs = {};

        for(const key of ["name", "value"]) {
          const input = document.createElement("input");
          input.type = "text";
          input.style.display = "block";
          input.style.width = "100%";
          input.style.height = "30px";
          input.style.boxSizing = "border-box";
          input.style.borderRadius = "0px";
          input.style.border = "1px solid " + ui.format.inactiveTabBackgroundColor;
          input.style.marginBottom = "10px";
          input.placeholder = "Property " + key;

          formContainer.appendChild(input);
          inputs[key] = input;
        }
        const validateBtn = document.createElement("button");
        mxUtils.write(validateBtn, "Add Live Property");
        validateBtn.style.width = "80%";

        mxEvent.addListener(validateBtn, mxEvent.CLICK, function() {
          if ((inputs.name.value !== "") && (inputs.value.value !== "")) {
            updateLiveAttrInFormatPanel(
              targetId, 
              live.property.prefix + inputs.name.value,
              inputs.value.value
            );
            inputs.name.value = "";
            inputs.value.value = "";
          }
          else {
            if(inputs.name.value === "") {
              log("New property must have a name !");
            }
            if(inputs.value.value === "") {
              log("New property must have a value !");
            }
          }
        });
        formContainer.appendChild(validateBtn);
        return formContainer;
      }

      // Adds node attributes & form to add a live attribute
      // if a graph node is selected
      if(!graph.isSelectionEmpty()) {
        liveFormatPanelContainer.append(
          buildPropertiesSubpanel(targetId),
          buildNewPropertyForm(targetId)
        );
      }
      return liveFormatPanelContainer;
    }

    /**
     * Updates a live attribute using Live custom format panel
     * @param {string} targetId Targetted graph node id
     * @param {string} attributeName Name of the attribute to update
     * @param {string} attributeValue Computed update value for target's selected attribute
     */
    function updateLiveAttrInFormatPanel(targetId, attributeName, attributeValue = null) {
      const selectedCells = [...ui.editor.graph.selectionModel.cells];
      const graphXml = ui.editor.getGraphXml();
      const target = mxUtils.findNode(
        graphXml,
        "id",
        targetId
      );

      attributeValue ? target.setAttribute(attributeName,attributeValue)
      : target.removeAttribute(attributeName);

      ui.editor.setGraphXml(graphXml);
      ui.editor.graph.selectionModel.changeSelection(selectedCells);

      const msg = {
        prop: "Property " + attributeName + " ",
        action: attributeValue ? "added on " : "removed from ",
        obj: targetId === "0" ? "graph base" : "object with id " + targetId        
      }
      log(msg.prop + msg.action + msg.obj);
      resetScheduleUpdate();
    }

    /**
     * Fetches the selected attribute value from computed exploitable API response
     * @param {object} exploitableData Parsed received response with 
     * @param {string} instructions js instructions list to retrieve value
     */
    function fetchAttrValueFromExploitableData(exploitableData, instructions) {
      const updatedValue = new Function(
        "data",
        instructions
      )(exploitableData);
      if(!updatedValue) {
        throw Error("Instructions set does not return anything");
      } else return updatedValue;
    }

    /**
     * Transforms raw API response to exploitable data depending on source
     * @param {object} raw Raw received API response
     * @param {string|function} source Path from raw or function to 
     * handle raw to get exploitable data
     * @returns computed exploitable data
     */
    function buildExploitableData(raw, source) {
      const exploitableData = (typeof source === "string") ? (
        new Function(
          "rawResponse",
          source ? "return rawResponse." + source : "return rawResponse"
        )(raw)
      ): (typeof source === "function") ? source(raw)
      : raw;
      
      if(exploitableData) return exploitableData;
      else {
        const errorMsg = (typeof source === "function") 
        ? "given function can't compute an exploitable object"
        :"'apiResponse." + source + "' does not return anything";
        throw Error("Error attempting to fetch data: " + errorMsg);
      }
    }

    /** Stops refresh process & prevents multiple threads */
    function clearThread(threadId) {
      clearTimeout(threadId);
      live.thread = null;
    }

    /** "live-start" action handler */
    function startScheduleUpdate() {
      if(live.thread === null) {
        doUpdate();
      } else {
        log("live thread already running - thread id:", live.thread);
      }
    };

    /** "live-pause" action handler */
    function pauseScheduleUpdate() {
      clearThread(live.thread);
    }

    /** Resets live update parameters */
    function resetScheduleUpdate() {
      live.ids = [];
      live.nodes = [];
      live.isInit = false;
      live.timeout = 0;
      live.graphPageId = "";
      clearThread(live.thread);
    }

    /** "live-restart" action handler */
    function restartScheduleUpdate() {
      resetScheduleUpdate();
      startScheduleUpdate();
    }

    /**
     * Gets credentials to perform requests to a distant api requiring authentication.  
     * Use live base credentials data if url is prefixed by base's **live.api** attribute,
     * otherwise use targetted graph node live attributes
     * @param {Node} target Targetted graph node
     * @param {Node} base Graph node with id = 0
     * @param {boolean} isUrlPrefixed True if url extends base's **live.api** attribute
     * @returns {object|null} credentials if exist or "null"
     */
    function getCredentials(target, base, isUrlPrefixed) {
      const credentials = {};
      for(const attribute of ["username", "apikey", "password"]) {
        credentials[attribute] = (isUrlPrefixed) 
        ? base.getAttribute(live[attribute])
        : target.getAttribute(live[attribute]);
      }
      return (credentials.username) ? credentials : null;
    }

    /**
     * Computes the url to request the corresponding API
     * @param {string} url Value stored in live attribute
     * @param {string} baseApi Value for **live.api** attribute stored in base node (with id = 0)
     * @param {string} nodeApi Value for **live.api** attribute stored in current object
     * @returns {string} The computed request url
     */
    function buildUrl(url, baseApi, nodeApi) {
      let request = "";
      if(url) {
        request = url.startsWith("http") ? url        // absolute path
        : url.startsWith("/") ?                       // relative path using
        (nodeApi) ? (nodeApi + url) : (baseApi + url) // object api or base api 
        : null;                                       // error
      } else {
        request = (nodeApi) ? nodeApi
        : (baseApi) ? baseApi : null;
      }
      if(request === null) throw Error("url pattern is wrong");
      return request;
    }

    /**
     * Checks recursively in xml tree & stores nodes containing live attributes
     * @param {Node} graphElement Current checked graph node
     * @param {Array} liveNodes List of identified graph live nodes
     */
    function findLiveNodes(graphElement, liveNodes = []) {
      // node with id === 0 is not checked
      if(graphElement.getAttribute("id") !== "0") {
        const elementId = graphElement.getAttribute("id");

        // checks if current node is live
        let isLiveElement = false;
        for (const attribute of graphElement.attributes) {
          if(attribute.name.startsWith("live.")) {
            isLiveElement = true;
            break;
          }
        }

        // stores element id if element is live
        if(isLiveElement) {
          liveNodes.push({graphNodeId: elementId,graphNode: graphElement});
        }
      }

      // if current element has children, finds live children
      if(graphElement.children.length > 0) {
        liveNodes = findLiveNodes(graphElement.firstChild, liveNodes);
      }

      // performs check for sibling
      const sibling = graphElement.nextElementSibling
      if(sibling !== null) {
        liveNodes = findLiveNodes(sibling, liveNodes);
      }
      return liveNodes;
    }

    /**
     * Computes path to access data from request response depending on stored
     * apitypes targetted with its id stored in **live.apitype** attributes,
     * or with **live.source** attributes in object & graph base
     * @param {string} nodeType Value for attribute live.api in selected node
     * @param {string} nodeSource Value for attribute live.source in selected node
     * @param {string} baseType Value for attribute live.api in graph base node
     * @param {string} baseSource Value for attribute live.source in graph base node
     * @returns {string|function} Path from or method to transform corresponding
     * api response in order to get an exploitable object
     */
    function getSourceForExploitableData(nodeType, nodeSource, baseType, baseSource) {
      // Gets "source" value if apitype is set
      function getFromApitype(apitype) {
        if(apitype) {
          const targettedApi = live.apitypes.find(
            api => (api.id === apitype)
          );
          if(targettedApi) {
            if(targettedApi.post) return targettedApi.post;
            else return targettedApi.source;
          }
        }
        return false;
      }
      return getFromApitype(nodeType) ? getFromApitype(nodeType)
      : (nodeSource) ? nodeSource
      : getFromApitype(baseType) ? getFromApitype(baseType)
      : (baseSource) ? baseSource
      : null;
    }

    /**
     * Adds to the graph object update node the 
     * updated value for corresponding attribute
     * @param {Node} updateNode XML node containing graph object update data
     * @param {string} attrName Graph object attribute name
     * @param {string} attrValue Graph object attribute updated value
     * @param {string} targetStyle Targetted graph node style
     */
    function fillUpdateNode(updateNode, attrName, attrValue, targetStyle) {
      if(attrName === live.text) {
        updateNode.setAttribute(
          "value", 
          `<object label="${attrValue}"/>`
        );
      } else if (attrName === live.style) {
        updateNode.setAttribute(
          "style", 
          attrValue
        );
      } else {
        const style = mxUtils.setStyle(
          updateNode.hasAttribute("style") ? updateNode.getAttribute("style") : targetStyle,
          live.property.getName(attrName), 
          attrValue
        );
        updateNode.setAttribute("style", style);
      }
    }

    /**
     * Requests an extarnal API & returns parsed received response
     * @param {string} url Url to request API
     * @param {boolean} isStringResponse True if API returns a simple response (string) 
     * False if returns a complex response
     * @param {object} credentials Object containing API authentication data
     * @returns {string|object} Parsed API response
     */
    function computeApiResponse(url, isSimpleResponse, credentials) {
      /** Fetches & returns data from distant API */
      function loadDataFromApi(url, credentials) {
        try {
          let req = undefined;
          if(credentials) {
            const {username, apikey, password} = credentials;
            req = new mxXmlRequest(
              url,
              null,
              "GET",
              false,
              username,
              password ? password : apikey
            )
            req.send(); 
          } else {
            req = mxUtils.load(url);
          }

          return req;
        } catch(e) {
          throw Error(e.message);
        }
      }

      /** Parses received response from distant API */
      function parseApiResponse(rawResponse, isSimpleResponse = true) {
        const parsedResponse = rawResponse.getText();
        if(parsedResponse.trim() === live.mxUtilsRequestErrorMsg) {
          throw Error("No response received from request");
        }
        if(isSimpleResponse) {
          return parsedResponse.replace(/"/g, "").trim();
        } else {
          return JSON.parse(parsedResponse);
        }
      } 

      try {
        const rawResponse = loadDataFromApi(url, credentials);
        const parsedResponse = parseApiResponse(rawResponse, isSimpleResponse);
        return parsedResponse;
      } catch(e) {
        throw Error("Error attempting to fetch data from " + url + ": " + e.message);
      }
    }

    /**
     * Builds a valid object from a broken API response
     * @param {JSON} json Invalid API received response
     * @returns rebuilt object
     */
    function hastatBuildObject(json) {
      const obj = [];
      for (const e1 of json) {
        const t = [];
        for (const e2 of e1)
          t[e2.field.name] = e2.value.value;
        obj[t["pxname"]][t["svname"]] = t;
      }
      return obj;
    }

    /** Performs an update process */
    function doUpdate() {
      clearThread(live.thread);
      const graphXml = ui.editor.getGraphXml();
      const baseNode = mxUtils.findNode(graphXml, "id", "0");

      if(!live.isInit) {
        live.timeout = (+(baseNode.getAttribute(live.refresh) + "000")) || 10000;
        live.graphPageId = ui.currentPage.node.id;
        live.nodes = findLiveNodes(graphXml);
        live.isInit = true;
      }

      // Initiates the xml doc to perform the updates 
      // & the array which stores data for complex APIs
      const xmlUpdatesDoc = mxUtils.createXmlDocument();
      const updatesList = xmlUpdatesDoc.createElement("updates");
      const complexApiResponses = [];
  
      for(const {graphNode, graphNodeId} of live.nodes) {
        if(!graphNodeId) continue;
        // Creates an update node for each targetted live node
        // which stores all updates for corresponding graph object
        const updateNode = xmlUpdatesDoc.createElement("update");
        updateNode.setAttribute("id", graphNodeId);

        // gets selected graph node's style to prevent style rewriting
        const style = (
          graphNode.firstChild.getAttribute("style") || 
          graphNode.getAttribute("style")
        );

        for(const {name: attrName, value: attrValue} of graphNode.attributes) {
          // Handles case of live attribute but not valid
          function currentAttributeIsLive() {
            if(!attrName.startsWith("live.")) return false;
            else {
              for(const unavailableLiveAttribute of [
                live.api,
                live.refresh,
                live.username,
                live.apikey,
                live.password,
                live.data,
                live.source,
                live.apitype
              ]) {
                if(attrName === unavailableLiveAttribute) return false;
              }
              return true;
            }
          }

          // Targets attribute if attribut is valid live one
          if(currentAttributeIsLive()) {
            try {
              const isComplexAttr = attrValue.startsWith("=");

              const url = buildUrl(
                isComplexAttr ? graphNode.getAttribute(live.data) : attrValue,
                baseNode.getAttribute(live.api),
                graphNode.getAttribute(live.api)
              );

              const targettedApi = complexApiResponses.find(
                (response => response.url === url)
              );

              let updatedAttrValue = null;
              if(!isComplexAttr || !targettedApi) {
                const credentials = getCredentials(
                  graphNode,
                  baseNode,
                  isComplexAttr ? graphNode.getAttribute(live.data).startsWith("/")
                  : attrValue.startsWith("/")
                );

                updatedAttrValue = computeApiResponse(
                  url, 
                  !isComplexAttr, 
                  credentials
                );
              }

              if(isComplexAttr) {
                let parsed = null;
                if(!targettedApi) {
                  const raw = {...updatedAttrValue};
                  const source = getSourceForExploitableData(
                    graphNode.getAttribute(live.apitype),
                    graphNode.getAttribute(live.source),
                    baseNode.getAttribute(live.apitype),
                    baseNode.getAttribute(live.source),
                  );
                  parsed = buildExploitableData(raw, source);
                  complexApiResponses.push({url, response: parsed});
                }

                updatedAttrValue = fetchAttrValueFromExploitableData(
                  targettedApi ? targettedApi.response : parsed,
                  attrValue.slice(1)
                );
              } 

              fillUpdateNode(
                updateNode,
                attrName,
                updatedAttrValue,
                style
              );
            } catch(e) {
              log(
                "Graph object id:", graphNodeId,
                "| Attribute:", attrName,
                "\n", e.message
              );
            }
          }
        }
        updatesList.appendChild(updateNode);
      }
      // Appends "updates" filled node to the new doc & updates
      // diagram or stops update pipeline if graph page changed
      if(ui.currentPage.node.id === live.graphPageId) {
        xmlUpdatesDoc.appendChild(updatesList);
        ui.updateDiagram(
          mxUtils.getXml(xmlUpdatesDoc)
        );
        live.thread = setTimeout(
          doUpdate,
          live.timeout
        );
      }
      else {
        log("Page changed, plugin stopped");
        resetScheduleUpdate();
      }
    }

    function log(...text) {
      console.log("liveUpdate plugin:", ...text);
    }

    initPlugin();
  }
);
