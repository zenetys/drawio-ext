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
      sourceDefaultValue: "hits.hits[0]._source",
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
        currentSelectedId: 0,
        isDisplayed: false,
        sections: [],
      }
    };

    ui.format.showCloseButton = false;
    ui.editor.addListener("fileLoaded", function() {
      addLiveUpdatePalette();
      overrideFormatPanelAction();
      addLiveTabToFormatPanel();

      ui.editor.graph.getSelectionModel().addListener(
        mxEvent.CHANGE, 
        addLiveTabToFormatPanel
      );
    });

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
              console.log(id, ui.format.panels[id])
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
        ["API URL", live.api],
        ["API Refresh", live.refresh],
      ];
      const objectAttributes = [
        ["Dynamic Object", live.data],
        ["API Type", live.apitype],
        ["Dynamic Source", live.source],
        ["Dynamic Text", live.text],
        ["Dynamic Style", live.style],
      ];

      liveFormatPanelContainer.appendChild(
        buildPanel("Diagram", rootAttributes, "0")
      );
      if(!graph.isSelectionEmpty()) {
        liveFormatPanelContainer.appendChild(
          buildPanel(
            "Object", 
            objectAttributes, 
            graph.selectionModel.cells[0].getId()
          )
        );
      }
      return liveFormatPanelContainer;

      function buildPanel(title, content, targetId) {
        const panelContainer = new BaseFormatPanel().createPanel();
        const titleContainer = new BaseFormatPanel().createTitle(title);
        panelContainer.appendChild(titleContainer);
        for(const input of content) {
          const [displayedText, attributeName] = input;
          panelContainer.appendChild(
            buildInput(displayedText,attributeName,targetId)
          );
        }
        return panelContainer;
      }

      function buildInput(displayedText, attrName, targetId) {
        const emptyValue = "-";
        const target = mxUtils.findNode(graphXml, "id", targetId);
        const value = target.getAttribute(attrName) || emptyValue;

        const inputSection = document.createElement('section');
        inputSection.style.padding = '6px 0px 1px 1px';
        inputSection.style.whiteSpace = 'nowrap';
        inputSection.style.overflow = 'hidden';
        inputSection.style.fontWeight = "normal";

        const cb = document.createElement('input');
        cb.setAttribute('type', 'checkbox');
        cb.style.margin = '0px 6px 0px 0px';
        cb.checked = value !== emptyValue;
        cb.title = (cb.checked ? "Remove":"Add") + " attribute";
        mxEvent.addListener(cb, 'click', handleClickOnCheckbox)
        inputSection.appendChild(cb);

        const displayedName = document.createElement("label");
        mxUtils.write(displayedName, displayedText);
        inputSection.appendChild(displayedName);
  
        const attributeValue = document.createElement('input');
        attributeValue.style.backgroundColor = "transparent";
        attributeValue.style.display = "block";
        attributeValue.style.width = "200px";
        attributeValue.type = "text";
        attributeValue.value = value;
        attributeValue.style.border = "none";

        mxEvent.addListener(attributeValue, "keydown", handleKeyDownOnTextInput);
        mxEvent.addListener(attributeValue, "focus", handleFocusOnTextInput);
        mxEvent.addListener(attributeValue, "focusout", handleFocusoutOfTextInput);

        inputSection.appendChild(attributeValue);
        return inputSection;

        function handleFocusOnTextInput(e) {
          e.preventDefault();
          if(attributeValue.value === emptyValue) {
            attributeValue.value = "";
          }
        }
        function handleKeyDownOnTextInput(e) {
          if(e.key === "Enter") {
            const attrNewValue = e.target.value;
            updateLiveAttribute(targetId, attrName, attrNewValue);
          }
          if(e.key === "Escape") {
            document.activeElement.blur();
          }
        }
        function handleFocusoutOfTextInput() {
          attributeValue.value = mxUtils.findNode(
            graphXml, 
            "id", 
            targetId
          ).getAttribute(attrName) || emptyValue;
        }
        function handleClickOnCheckbox(e) {
          e.preventDefault();
          const isChecked = !e.target.checked;
          if(isChecked) {
            if(mxUtils.confirm("Are you sure to remove " + attrName + " ?")) {
              updateLiveAttribute(targetId, attrName);
            }
          } else {
            attributeValue.focus();
          }
        }
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

      target.setAttribute(
        attributeName,
        attributeValue ? attributeValue : ""
      );

      ui.editor.setGraphXml(graphXml);
      refreshLiveFormatPanel();
      ui.editor.graph.selectionModel.changeSelection(selectedCells)
    }

    /** Refreshes Format Panel with "Live" custom tab */
    function refreshLiveFormatPanel() {
      ui.actions.get("formatPanel").funct();
      ui.actions.get("formatPanel").funct();
    }

    /** Performs an update process */
    function doUpdate() {
      clearThread(live.thread);
      const graph = ui.editor.getGraphXml();
      const root = graph.firstChild;
      
      // when inits or restarts
      if(!live.isInit) {
        live.timeout = (+(root.firstChild.getAttribute(live.refresh) + "000")) || 10000;
        live.graphPageId = ui.currentPage.node.id;
        live.nodes = findLiveNodes(graph);
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
          // targets all live properties
          if(attrName.startsWith("live.")) {
            if(attrName !== live.data && attrName !== live.source) {
              const updateOptions = {
                node,
                attrName,
                attrValue,
                apiPrefix: root.firstChild.getAttribute(live.api)
              };
  
              try {
                if(attrValue.startsWith("=")) { // case: live object
                  storeLiveObjectsData(liveObjects, updateOptions);
                } else { // case: live value
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
          }
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
      if(ui.currentPage.node.id === live.graphPageId) {
        xmlUpdatesDoc.appendChild(updatesList);
        ui.updateDiagram(
          mxUtils.getXml(xmlUpdatesDoc)
        );
        live.thread = setTimeout(
          doUpdate,
          live.timeout
        );
        refreshLiveFormatPanel();
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
          addLiveTabToFormatPanel();
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
    function fetchLiveValue(currentLiveNode, options) {
      const {node, attrName, attrValue, apiPrefix} = options;
      const style = node.firstChild.getAttribute("style");
      const url = computeRequest(attrValue, apiPrefix);
      const liveValue = computeApiResponse(url, true);

      fillUpdateNode(
        currentLiveNode, 
        attrName, 
        liveValue, 
        style
      );
    }

    /** Computes the request to call the API according to the given uri */
    function computeRequest(url, rootApi) {
      const request = url.startsWith("http") ? url  // absolute path
      : url.startsWith("/") ? rootApi + url         // relative path
      : null;                                       // error
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
      const {node, attrName, attrValue, apiPrefix} = options;
      const url = node.hasAttribute(live.data) 
      ? computeRequest(
        node.getAttribute(live.data),
        apiPrefix
      ) : apiPrefix;

      // stores path from received response to fetch data
      const source = node.hasAttribute(live.source) 
      ? node.getAttribute(live.source)
      : live.sourceDefaultValue; 
      const nodeId = node.getAttribute("id");
      const newListenerAttr = {
        attrName,
        attrValue: attrValue.slice(1)
        // slice => retrieves the first "="
      };

      const newListener = {
        id: nodeId,
        style: node.firstChild.getAttribute("style"),
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

    /** Computes values for each object attributes of a live node */
    function computeLiveObject(object, updates, createNode) {
      const {url, source, listeners} = object;
      const liveRawObject = computeApiResponse(url, false);

      const dataSource = new Function(
        "responseRoot", 
        "return responseRoot." + source
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
