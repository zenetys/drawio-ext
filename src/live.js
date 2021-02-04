/**
 * Live Update plugin.
 * Allows you to update separately each selected graph element.
 * 
 * Use "live.api" and "live.refresh" in the meta data of the diagram to configure 
 * the plugin:
 * 
 *    - live.api: url prefix to request the distant API (optional, see below).
 *    - live.refresh: interval between 2 updates, set in seconds (optional, 
 *      default is 10s).
 *    - Both are stored as attributes for the graph element with id = 0.
 * 
 * If you want a graph element becomes live updatable, you must add at least one 
 * of the following properties to the element (right click > "Edit Data" or 
 * CTRL+M):
 * 
 *    - live.text: updates element text node.
 *    - live.style: updates element style.
 *    - live.property.<PROPERTY_NAME>: updates element <PROPERTY_NAME> value.
 *        Example: "live.property.fillOpacity" updates "Fill Opacity" element 
 *        property.
 * 
 * The value for each live property is the url used to get the requested resource.
 * The value can be an absolute path (ex: https://my.api/path/to/resource) or a 
 * relative path: in this case, stored value is concatenated with live.api prefix 
 * to build the request full url.
 * 
 * The APIs receiving requests MUST respond only a string corresponding to the 
 * updated value for the requested attribute:
 *    - "live.text" endpoint only returns updated displayed text.
 *    - "live.style" endpoint returns full updated element style.
 *    - "live.property.<PROPERTY_NAME>" endpoint only returns the updated value 
 *      for corresponding element property.
 * 
 * To handle live update behaviour, use the buttons stored in interface toolbar:
 * 
 *    - ⏺︎ (Play) : Starts the plugin feature.
 *    - ⏸ (Pause) : Stops the feature.
 *    - 🔄 (Restart) : Updates graph element & starts the feature.
 * 
 * If plugin is running on a page & you switch to another, plugin autostops.
 * 
 * Difference between Play & Restart: 
 * 
 * When played for first time, plugin stores the ids of all current graph live 
 * elements, to not have to fetch them each time there is an update. 
 * When Pause is clicked, live update feature is disabled but the stored ids stay, 
 * then id storage is not done when you click on Play. 
 * If the graph changes during the pause with live elements added or removed, you 
 * should click on Restart to perform the ids storage in the current graph & avoid 
 * troubles.
 */
Draw.loadPlugin(
  function(ui) {
    // stores live properties values
    const live = {
      thread: null,
      api: "live.api",
      apitype: "live.apitype",
      refresh: "live.refresh",
      style: "live.style",
      text: "live.text",
      data: "live.data",
      source: "live.source",
      apitypes: [
        {
          id: "elastic",
          source: "hits.hits[0]._source"
        }
      ],
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

    initPlugin();

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

    function overrideFormatPanelRefresh() {
      const formatRefreshBasicFunc = ui.format.refresh;
      ui.format.refresh = function() {
        mxUtils.bind(ui.format,formatRefreshBasicFunc)();
        addLiveTabToFormatPanel();
      }
    }

    /** Adds "Live" custom format tab in Format Panel */
    function addLiveTabToFormatPanel() {
      const formatContainer = document.querySelector(".geFormatContainer");
      const formatHeaders = formatContainer.firstChild;
      if(!formatHeaders) return;
      const formatWidth = parseInt(formatContainer.style.width);
      const headersNb = formatHeaders.childNodes.length;

      if(formatWidth > 0) {
        const headerLength = parseInt(formatWidth / (headersNb + 1));
        for(const header of formatHeaders.children) {
          header.style.width = headerLength + "px";
        }

        const liveHeader = formatHeaders.firstChild.cloneNode(false);
        liveHeader.style.width = headerLength;
        setTabStyle(liveHeader);
        mxUtils.write(liveHeader, "Live");
        formatHeaders.appendChild(liveHeader);

        const liveContent = buildLiveFormatPanelContent();
        if(live.formatPanel.isDisplayed) {
          handleLiveFormatPanelDisplay(liveHeader);
        }

        mxEvent.addListener(formatHeaders, "click", function(e) {
          handleLiveFormatPanelDisplay(e.target);
        });

        function handleLiveFormatPanelDisplay(target) {
          if(target === liveHeader) {
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

        function setTabStyle(elt, isActiveTab = false) {
          elt.style.backgroundColor = isActiveTab ? "inherit"
          : ui.format.inactiveTabBackgroundColor;
          elt.style.borderWidth = "0px";
          elt.style.borderLeftWidth = "1px";
          elt.style.borderBottomWidth = isActiveTab ? "0px" : "1px";
        }
      }
    }

    /** Builds content in Live Format Panel */
    function buildLiveFormatPanelContent() {
      const graphXml = ui.editor.getGraphXml();
      const graph = ui.editor.graph;
      
      const liveFormatPanelContainer = document.createElement('section');
      liveFormatPanelContainer.style.whiteSpace = 'nowrap';
      liveFormatPanelContainer.style.color = 'rgb(112, 112, 112)';
      liveFormatPanelContainer.style.textAlign = 'left';
      liveFormatPanelContainer.style.cursor = 'default';

      const rootAttributes = [
        ["API", live.api],
        ["API Type", live.apitype],
        ["Source", live.source],
        ["Refresh", live.refresh],
      ];
      const objectAttributes = [
        ["Object", live.data],
        ["Text", live.text],
        ["Style", live.style],
      ];

      const targetId = graph.isSelectionEmpty() ? "0"
      : graph.selectionModel.cells[0].getId();

      liveFormatPanelContainer.appendChild(
        buildPanel(
          targetId === "0" ? "Diagram" : "Object " + targetId,
          targetId,
          rootAttributes,
          objectAttributes
        )
      );

      if(!graph.isSelectionEmpty()) {
        liveFormatPanelContainer.append(
          buildProperties(targetId),
          buildNewPropertyForm(targetId)
        );
      }
      return liveFormatPanelContainer;

      function buildPanel(title, targetId, rootInputs, objectInputs) {
        const isObjectSelected = targetId !== "0";
        const panelContainer = new BaseFormatPanel().createPanel();
        const titleContainer = new BaseFormatPanel().createTitle(title);
        panelContainer.style.padding = "12px";

        titleContainer.style.width = "100%";
        panelContainer.appendChild(titleContainer);

        handlePanelInputs(rootInputs, panelContainer, targetId);
        if(isObjectSelected) {
          handlePanelInputs(objectInputs, panelContainer, targetId);
        }
        return panelContainer;
      }

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

          inputSection.appendChild(cb);
          inputSection.appendChild(label);
          inputSection.appendChild(shortField);
          inputSection.appendChild(longField);
          container.appendChild(inputSection);
        }
      }

      function buildInput(text, attrName, targetId) {
        const emptyValue = "";
        const target = mxUtils.findNode(graphXml, "id", targetId);
        const root = mxUtils.findNode(graphXml, "id", "0");
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
        
        shortField.placeholder = (attrName === live.apitype) ? "raw"
        : (attrName === live.source) ? getSourceValue(target, root)
        : root.hasAttribute(attrName) ? root.getAttribute(attrName)
        : emptyValue;

        const longField = document.createElement("textarea");
        longField.rows = 5;
        longField.style.boxSizing = "border-box";
        longField.style.width = "100%";
        longField.style.padding = "0px";
        longField.style.margin = "0px";
        longField.style.resize = "none";
        longField.style.border = "1px solid " + ui.format.inactiveTabBackgroundColor;
        longField.style.display = "none";
        longField.style.outline = "none";
        longField.style.borderRadius = "0px";
        longField.value = value;
        longField.placeholder = shortField.placeholder;
        longField.style.fontStyle = (value) ? "normal" : "italic";

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

        function getSourceValue(target, root) {
          function computeSource(elt) {
            if(elt.hasAttribute(live.apitype)) {
              const apiType = live.apitypes.find(
                (api) => (api.id === elt.getAttribute(live.apitype))
              );
              return apiType ? `api ${apiType.id} => ${apiType.source}`:false;
            }
          }
          return computeSource(target) ? computeSource(target)
          : computeSource(root) ? computeSource(root) 
          : root.hasAttribute(live.source) ? root.getAttribute(live.source)
          : emptyValue;
        }

        function handleFocusOnShortField(e) {
          e.preventDefault();
          shortField.style.display = "none";
          longField.style.display = "block";
          longField.focus();
        }
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
            updateLiveAttribute(targetId, attrName, longField.value);
          }
          longField.style.display = "none";
          shortField.style.display = "inline";
        }
        function handleClickOnCheckbox(e) {
          e.preventDefault();
          const isChecked = !e.target.checked;
          if(isChecked) {
            if(mxUtils.confirm("Are you sure to remove " + attrName + " ?")) {
              updateLiveAttribute(targetId, attrName);
            }
          } else {
            shortField.focus();
          }
        }
      }

      function buildProperties(targetId) {
        const target = mxUtils.findNode(graphXml, "id", targetId);

        const panelContainer = new BaseFormatPanel().createPanel();
        panelContainer.style.padding = "0";
        const propertiesTable = document.createElement("table");
        propertiesTable.classList.add("geProperties");
        propertiesTable.style.whiteSpace = "nowrap";
        propertiesTable.style.width = "100%";
        propertiesTable.style.tableLayout = "fixed";
        propertiesTable.style.borderCollapse = "collapse";
        panelContainer.appendChild(propertiesTable);

        const tr = document.createElement("tr");
        tr.classList.add("gePropHeader");
        propertiesTable.appendChild(tr);
        
        const headerCells = [
          [" ", "15px"],
          ["Property", "75px"],
          ["Value", "inherit"],
        ];
        for(const headerCell of headerCells) {
          const th = document.createElement("th");
          th.classList.add("gePropHeaderCell");
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

            shortField.style.width = "calc(100% - 12px)";
            shortField.style.height = "20px";
            shortField.style.float = "left";
            longField.style.border = "1px solid " + ui.format.inactiveTabBackgroundColor;
            longField.style.borderRadius = "0px";
            const cells = [
              cb, 
              label, 
              shortField
            ];

            for(const cellContent of cells) {
              const td = document.createElement("td");
              if(cellContent === cb) {
                td.style.textAlign = "center";
                td.style.verticalAlign = "center";
                cb.style.margin = "0";

              }

              if(typeof cellContent === "string") {
                mxUtils.write(td, cellContent);
              } else {
                td.appendChild(cellContent);
              }
              newLine.appendChild(td);
            }

            const longFieldCell = document.createElement("th");
            longFieldCell.colSpan = "3";
            longFieldCell.style.padding = "0 12px";
            longFieldCell.appendChild(longField)

            propertiesTable.appendChild(newLine);
            propertiesTable.appendChild(longFieldCell);
          }
        }
        return panelContainer;
      }

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
            updateLiveAttribute(
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
        })
        formContainer.appendChild(validateBtn);


        return formContainer;
      }
    }

    /** Updates live attribute using "Live" custom format panel */
    function updateLiveAttribute(objectId, attributeName, attributeValue = null) {
      const selectedCells = [...ui.editor.graph.selectionModel.cells];
      const graphXml = ui.editor.getGraphXml();
      const target = mxUtils.findNode(
        graphXml,
        "id",
        objectId
      );

      attributeValue ? target.setAttribute(attributeName,attributeValue)
      : target.removeAttribute(attributeName);

      ui.editor.setGraphXml(graphXml);
      // refreshLiveFormatPanel();
      ui.editor.graph.selectionModel.changeSelection(selectedCells);

      const msg = {
        prop: "Property " + attributeName + " ",
        action: attributeValue ? "added on " : "removed from ",
        obj: objectId === "0" ? "graph root" : "object with id " + objectId        
      }
      log(msg.prop + msg.action + msg.obj);
      resetScheduleUpdate();
    }

    /** Refreshes Format Panel with "Live" custom tab */
    function refreshLiveFormatPanel() {
      ui.actions.get("formatPanel").funct();
      ui.actions.get("formatPanel").funct();
    }

    /** Performs an update process */
    function doUpdate() {
      clearThread(live.thread);
      const graphXml = ui.editor.getGraphXml();
      const root = mxUtils.findNode(graphXml, 'id', "0");

      // when inits or restarts
      if(!live.isInit) {
        live.timeout = (+(root.getAttribute(live.refresh) + "000")) || 60000;
        live.graphPageId = ui.currentPage.node.id;
        live.nodes = findLiveNodes(graphXml);
        live.isInit = true;
      }

      // initiates the xml doc to perform the updates & the array which stores live objects data
      const xmlUpdatesDoc = mxUtils.createXmlDocument();
      const updatesList = xmlUpdatesDoc.createElement("updates");
      const liveObjects = [];
  
      for(const {node, id} of live.nodes) {
        // creates an update node for each targetted live node
        const updateNode = xmlUpdatesDoc.createElement("update");
        updateNode.setAttribute("id", id);

        for(const {name: attrName, value: attrValue} of node.attributes) {
          function currentAttributeIsLive() {
            if(!attrName.startsWith("live.")) {
              return false;
            } else {
              for(const unavailableLiveAttribute of [
                live.api,
                live.refresh,
                live.data,
                live.source,
                live.apitype
              ]) {
                if(attrName === unavailableLiveAttribute) return false;
              }
              return true;
            }
          }

          // if(attrName.startsWith("live.")) {
          // targets all live attributes
          if(currentAttributeIsLive()) {
            const updateOptions = {
              node,
              attrName,
              attrValue,
              rootApi: root.getAttribute(live.api),
              rootType: root.getAttribute(live.apitype),
              rootSource: root.getAttribute(live.source),
              nodeStyle: node.firstChild.getAttribute("style") || node.getAttribute("style")
            };

            try {
              if(attrValue.startsWith("=")) {
                storeLiveObjectsData(liveObjects, updateOptions);
              } else {
                fetchLiveValue(updateNode, updateOptions);
              }
            } catch(e) {
              log(
                "Graph object id:", id,
                "| Attribute:", attrName,
                "\n", e.message
              );
            }
          }
          // }
        }
        updatesList.appendChild(updateNode);
      }

      // performs updates for each live object previously stored
      for(const liveObjectData of liveObjects) {
        try {
          computeLiveObject(
            liveObjectData, 
            updatesList, 
            xmlUpdatesDoc.createElement
          );
        } catch(e) {
          log("Request url: ", liveObjectData.url, "\n", e.message);
        }
      }

      // appends "updates" node to the new doc & updates diagram with it
      // or stops update pipeline if graph page changed
      if(ui.currentPage.node.id === live.graphPageId) {
        xmlUpdatesDoc.appendChild(updatesList);
        ui.updateDiagram(
          mxUtils.getXml(xmlUpdatesDoc)
        );
        live.thread = setTimeout(
          doUpdate,
          live.timeout
        );
        // refreshLiveFormatPanel();
      }
      else {
        log("Page changed, plugin stopped");
        resetScheduleUpdate();
      }
    }

    /** Adds a new palette with buttons to handle the live state in the toolbar */
    function addLiveUpdatePalette() {
      if(!ui.toolbar) {
        log("Toolbar doesn't exist. Plugin is inactive...")
      }
      else {
        function addLiveButton(...buttons) {
          for(const button of buttons) {
            ui.toolbar.addMenuFunction(
              button.label,
              button.tooltip,
              true,
              button.funct,
              ui.toolbar.container
            );
          }
        }

        ui.toolbar.addSeparator();
        addLiveButton({
          label: "⏺︎",
          tooltip: "Start graph live update",
          funct: startScheduleUpdate
        },{
          label: "⏸",
          tooltip: "Stop graph live update",
          funct: pauseScheduleUpdate
        },{
          label: "🔄",
          tooltip: "Reload current graph & start live update",
          funct: restartScheduleUpdate
        });
      }
    }

    /** Overrides "formatPanel" action to allows to handle panel behaviour */
    function overrideFormatPanelAction() {
      const initialAction = ui.actions.get('formatPanel').funct;
      ui.actions.addAction(
        'formatPanel', 
        function() {
          initialAction();
          console.log("action 'formatPanel")
          // addLiveTabToFormatPanel();
        }
      );
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

    /** Fecthes value from distant api for current attribute */
    function fetchLiveValue(updateNode, options) {
      const {node, attrName, attrValue, rootApi,nodeStyle} = options;
      const url = computeRequest(attrValue, rootApi, node.getAttribute(live.api));
      const liveValue = computeApiResponse(url, true);
      fillUpdateNode(
        updateNode, 
        attrName, 
        liveValue, 
        nodeStyle
      );
    }

    /** Computes the request to call the API according to the given uri */
    function computeRequest(url, rootApi, nodeApi) {
      let request = "";
      if(url) {
        request = url.startsWith("http") ? url        // absolute path
        : url.startsWith("/") ?                       // relative path using
        (nodeApi) ? (nodeApi + url) : (rootApi + url)     // object api or root api 
        : null;                                       // error
      } else {
        request = (nodeApi) ? nodeApi
        : (rootApi) ? rootApi : null;
      }
      if(request === null) throw Error("url pattern is wrong");
      return request;
    }

    /** Checks recursively in xml tree & stores nodes if they are live ones */
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
          liveNodes.push({id: elementId,node: graphElement});
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

    /** Stores data to update a node attribute from distant js object */
    function storeLiveObjectsData(currentList, options) {
      const {node, attrName, attrValue, rootApi, rootType, rootSource, nodeStyle} = options;

      // computes request url depending on given attributes in object & graph root
      const url = computeRequest(
        node.getAttribute(live.data),
        rootApi,
        node.getAttribute(live.api)
      );

      // stores path from received response to fetch data
      const source = getSourceFromSpecificApi(
        node.getAttribute(live.apitype),
        node.getAttribute(live.source),
        rootType,
        rootSource
      );

      // const source = node.hasAttribute(live.apitype) ? getSourceFromSpecificApi(
      //   node.getAttribute(live.apitype)
      // ): node.hasAttribute(live.source) ? node.getAttribute(live.source)
      // : null; 

      const nodeId = node.getAttribute("id");
      const newListenerAttr = {
        attrName,
        attrValue: attrValue.slice(1) // slice => retrieves the first "="
      };

      const newListener = {
        id: nodeId,
        style: nodeStyle,//: node.firstChild.getAttribute("style"),
        attrs: [
          newListenerAttr
        ]
      };
      const idInList = currentList.findIndex(
        objectData => (objectData.url === url)
      );

      if(idInList === -1) {
        const newObjectData = {
          url,
          source,
          listeners: [
            newListener
          ]
        };
        currentList.push(newObjectData);
      } else {
        const listenerId = currentList[idInList].listeners.findIndex(
          listener => (listener.id === nodeId)
        );

        if(listenerId === -1) {
          currentList[idInList].listeners.push(newListener);
        } else {
          currentList[idInList].listeners[listenerId].attrs.push(
            newListenerAttr
          );
        }
      }
    }

    /** Computes source from api targetted with its id in stored apitypes */
    function getSourceFromSpecificApi(nodeType, nodeSource, rootType, rootSource) {

      function getSourceFromApitype(apitype) {
        if(apitype) {
          const targettedApi = live.apitypes.find(
            api => (api.id === apitype)
          );
          if(targettedApi) return targettedApi.source;
        }
        return false;
      }
      return getSourceFromApitype(nodeType) ? getSourceFromApitype(nodeType)
      : (nodeSource) ? nodeSource
      : getSourceFromApitype(rootType) ? getSourceFromApitype(rootType)
      : (rootSource) ? rootSource
      : null;
    }

    /** Computes values for each object attributes of a live node */
    function computeLiveObject(object, updates, createNode) {
      const {url, source, listeners} = object;
      const liveRawObject = computeApiResponse(url, false);

      const dataSource = new Function(
        "responseRoot", 
        source ? "return responseRoot." + source : "return responseRoot"
      )(liveRawObject);

      if(!dataSource) {
        throw Error(
          "Error attempting to get data: 'apiResponse." + 
          source + 
          "' does not exist"
        );
      } 

      for(const listener of listeners) {
        const existingNode = mxUtils.findNode(
          updates,
          "id",
          listener.id
        );
        const update = {};
        update.node = existingNode ? existingNode : createNode("update");
        update.isNew = existingNode ? true : false;

        for(const {attrName, attrValue} of listener.attrs) {
          const attrUpdatedValue = new Function(
            "data",
            attrValue
          )(dataSource);
          if(!attrUpdatedValue) {
            throw Error(
              "Error attempting to update graph object with id " +
              listener.id +
              " for attribute " +
              attrName +
              ": value must return something"
            );
          }

          fillUpdateNode(
            update.node, 
            attrName, 
            attrUpdatedValue,
            listener.style
          );
        }
        if(!update.isNew) updates.appendChild(update.node);
      }
    }

    /** Fills an update node */
    function fillUpdateNode(updateNode, attrName, attrValue, inputStyle) {
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
          updateNode.hasAttribute("style") ? updateNode.getAttribute("style") : inputStyle,
          live.property.getName(attrName), 
          attrValue
        );
        updateNode.setAttribute("style", style);
      }
    }

    /** Sends request to distant api & parses response in the corproper form */
    function computeApiResponse(url, isString) {
      function loadDataFromApi(url) {
        try {
          const res = mxUtils.load(url);
          return res;
        } catch(e) {
          const msgSuffix = isString ? " from " + url : "";
          throw Error("Cannot load data" + msgSuffix);
        }
      }

      /** Parses received response from distant API */
      function parseApiResponse(rawResponse, isString = true) {
        const parsedResponse = rawResponse.getText();
        if(parsedResponse.trim() === live.mxUtilsRequestErrorMsg) {
          throw Error("No response received from request");
        }
        if(isString) {
          return parsedResponse.replace(/"/g, "").trim();
        } else {
          return JSON.parse(parsedResponse);
        }
      } 

      try {
        const rawResponse = loadDataFromApi(url);
        const parsedResponse = parseApiResponse(rawResponse, isString);
        return parsedResponse;
      } catch(e) {
        throw Error("Error attempting to fetch data: " + e.message);
      }
    }

    function log(...text) {
      console.log("liveUpdate plugin:", ...text);
    }
  }
);
