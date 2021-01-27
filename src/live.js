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

    /** Stores data to build Live Format Panel data */
    function storeFormatPanelData(objectId = undefined) {
      const graph = ui.editor.getGraphXml();
      const root = graph.firstChild.firstChild;

      //inits Live Format panel with diagram data
      const livePanelData = [{
        header: "Diagram Data",
        entries: [
          {
            label: "API URL",
            raw: live.api,
            value: root.getAttribute(live.api)
          },
          {
            label: "API Refresh",
            raw: live.refresh,
            value: root.getAttribute(live.refresh)
          }
        ]
      }];

      // gets selected node with its id if a node is selected
      const target = mxUtils.findNode(
        graph,
        "id",
        objectId
      );

      if(target) {
        const objectData = {
          header: "Object Data",
          entries: [{
            label: "Object ID",
            value: objectId
          }]
        };
        const properties = {
          header: "Properties",
          entries: []
        };
  
        for(const attr of target.attributes) {
          if(attr.name.startsWith("live.")) {
            // stores attribute in object data or properties
            const attrName = attr.name === live.data ? [1, "Dynamic Object", live.data]
            : attr.name === live.source ? [2, "Dynamic Source", live.source]
            : attr.name === live.text ? [3, "Dynamic Text", live.text]
            : attr.name === live.style ? [4, "Dynamic Style", live.style]
            : attr.name;
  
            if(Array.isArray(attrName)) {
              objectData.entries[attrName[0]] = {
                label: attrName[1],
                raw: attrName[2],
                value: attr.value
              };
            } else {
              properties.entries.push({
                label: live.property.getName(attrName),
                raw: attrName,
                value: attr.value
              });
            }
          }
        }
        livePanelData.push(objectData);
        livePanelData.push(properties);
      }
      live.formatPanel.sections = livePanelData;
    }

    ui.editor.addListener("fileLoaded", function() {
      addLiveUpdatePalette();
      overrideFormatPanelAction();
    });

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
        ui.toolbar.addSeparator();
        addLiveButton({
          label: "🔽",
          tooltip: "Show/Hide Live Format Panel",
          funct: toggleLiveFormatPanel
        })
      }
    }

    /** Overrides "formatPanel" action to allows to handle panel behaviour */
    function overrideFormatPanelAction() {
      const initialAction = ui.actions.get('formatPanel').funct;
      ui.actions.addAction(
        'formatPanel', 
        function(calledByLivePanelBtn = false) {
          const panelWasEnabled = ui.formatWidth !== 0;
          initialAction();

          if(panelWasEnabled) {
            if(live.formatPanel.isDisplayed && !calledByLivePanelBtn) {
              live.formatPanel.isDisplayed = false;
              initialAction();
            }
            else if(!live.formatPanel.isDisplayed && calledByLivePanelBtn) {
              live.formatPanel.isDisplayed = true;
              initialAction();
            }
            else {
              live.formatPanel.isDisplayed = false;
            }
          }
          else {
            live.formatPanel.isDisplayed = calledByLivePanelBtn;
          }
        }
      );

      /** Listener called when graph selection changes */
      function selectionChangeListener(sender, evt) {
        const currentNodeId = evt.properties.removed 
        ? evt.properties.removed[0].id
        : null;
        live.formatPanel.currentSelectedId = currentNodeId ? currentNodeId : "0";
        storeFormatPanelData(currentNodeId);
        
        if(live.formatPanel.isDisplayed === true) {
          // bypasses another listener to display live format panel
          toggleLiveFormatPanel();
          toggleLiveFormatPanel();
        }
      }
      ui.editor.graph.getSelectionModel().addListener(
        mxEvent.CHANGE, 
        selectionChangeListener
      );
      storeFormatPanelData();
    }

    /** Displays or hides live custom format panel in format panel container */
    function toggleLiveFormatPanel() {
      const container = document.querySelector(".geFormatContainer");
      ui.actions.get('formatPanel').funct(true);

      while(container.children.length > 0) {
        container.removeChild(container.children[0]);
      }
      displayLiveFormatPanel(container);
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
      const style = node.childNodes[0].getAttribute("style");
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
        style: node.childNodes[0].getAttribute("style"),
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

    /** Displays cutom Live panel in cleaned format panel */
    function displayLiveFormatPanel(panelContainer) {
      panelContainer.appendChild(
        addSectionToLivePanel({header: "Live"}, true)
      );
      for(const fpSection of live.formatPanel.sections) {
        panelContainer.appendChild(
          addSectionToLivePanel(fpSection)
        );
      }
      if(live.formatPanel.sections.length > 1) {
        panelContainer.appendChild(
          addNewLivePropertyFormSection()
        );
      }
    }

    /** Adds a section to the custom created format live panel */
    function addSectionToLivePanel(data, isTitle = false) {
      if(!data) return;
      const fpSectionContainer = document.createElement('section');
      fpSectionContainer.className = 'geFormatSection';
      fpSectionContainer.style.textAlign = "center";
      fpSectionContainer.style.whiteSpace = 'nowrap';
      fpSectionContainer.style.color = 'rgb(112, 112, 112)';
      fpSectionContainer.style.cursor = 'default';      
      fpSectionContainer.style.textAlign = 'center';
      fpSectionContainer.style.fontWeight = 'bold';
      fpSectionContainer.style.fontSize = '13px';
      fpSectionContainer.style.borderWidth = '0px 0px 1px 1px';
      fpSectionContainer.style.borderStyle = 'solid';
      fpSectionContainer.style.overflow = 'auto';      
      mxUtils.write(fpSectionContainer, data.header);

      if(isTitle) {
        fpSectionContainer.style.height = "38px";
        fpSectionContainer.style.lineHeight = "38px";
      } else {
        fpSectionContainer.style.paddingTop = "5px";
        fpSectionContainer.style.paddingBottom = "15px";
        if(data.entries) {
          for(const child of data.entries) {
            addLiveInput(child);
          }
        }
      }
      return (fpSectionContainer);

      /** Adds an input in the custom format panel current section */
      function addLiveInput(data) {
        if(!data) return;
        const objectIdLabel = "Object ID";

        const {
          label: attrName, 
          value: attrValue, 
          raw: attrRawName
        } = data;
        const inputContainer = document.createElement("section");

        const inputLabel = document.createElement("p");
        inputLabel.style.color = 'rgb(112, 112, 112)';
        inputLabel.style.fontWeight = 'bold';
        inputLabel.style.fontSize = '13px';
        inputLabel.style.padding = '10px 0px 1px 10px';
        inputLabel.style.margin = '0px';
        inputLabel.style.textAlign = 'left';
        
        const editBtn = document.createElement("button");
        editBtn.title = "Edit property";
        editBtn.style.borderColor = "transparent";

        if(attrName !== objectIdLabel) {
          mxUtils.write(editBtn, " ✎ ");
          inputLabel.appendChild(editBtn);
        }
        mxUtils.write(inputLabel, attrName);
        inputContainer.appendChild(inputLabel);
        
        const inputContent = document.createElement("input");
        inputContent.type = "text";
        inputContent.value = attrValue;
        inputContent.disabled = attrName === objectIdLabel;
        inputContent.style.border = "1px solid rgb(112, 112, 112)";
        inputContent.style.borderRadius = "3px";
        inputContent.style.padding = '0px';
        inputContent.style.margin = '0px';
        inputContainer.appendChild(inputContent);

        editBtn.onclick = function() {
          const graph = ui.editor.getGraphXml()
          const {currentSelectedId} = live.formatPanel;
          const isRootValue = (
            (attrRawName === live.refresh) || (attrRawName === live.api)
          );
          
          const targettedNode = mxUtils.findNode(
            graph,
            "id",
            isRootValue ? "0" : currentSelectedId
          );
          targettedNode.setAttribute(
            attrRawName,
            inputContent.value
          );
          
          ui.editor.setGraphXml(graph);
          toggleLiveFormatPanel();
          toggleLiveFormatPanel();
        }
        fpSectionContainer.appendChild(inputContainer);
      }
    }

    /** Adds a section  */
    function addNewLivePropertyFormSection() {
      const propContainer = document.createElement('section');
      propContainer.className = 'geFormatSection';
      propContainer.style.textAlign = "center";
      propContainer.style.whiteSpace = 'nowrap';
      propContainer.style.color = 'rgb(112, 112, 112)';
      propContainer.style.cursor = 'default';      
      propContainer.style.textAlign = 'center';
      propContainer.style.paddingTop = "5px";
      propContainer.style.paddingBottom = "15px";
      propContainer.style.fontWeight = 'bold';
      propContainer.style.fontSize = '13px';
      propContainer.style.borderWidth = '0px 0px 1px 1px';
      propContainer.style.borderStyle = 'solid';
      propContainer.style.overflow = 'auto';      
      mxUtils.write(propContainer, "Add Property");

      const nameLabel = document.createElement("p");
      nameLabel.style.color = 'rgb(112, 112, 112)';
      nameLabel.style.fontWeight = 'bold';
      nameLabel.style.fontSize = '13px';
      nameLabel.style.padding = '10px 0px 1px 10px';
      nameLabel.style.margin = '0px';
      nameLabel.style.textAlign = 'left';
      mxUtils.write(nameLabel, "Live property name");
      propContainer.appendChild(nameLabel);
      
      const nameContent = document.createElement("input");
      nameContent.type = "text";
      nameContent.style.border = "1px solid rgb(112, 112, 112)";
      nameContent.style.borderRadius = "3px";
      nameContent.style.padding = '0px';
      nameContent.style.margin = '0px';
      propContainer.appendChild(nameContent);

      const valueLabel = document.createElement("p");
      valueLabel.style.color = 'rgb(112, 112, 112)';
      valueLabel.style.fontWeight = 'bold';
      valueLabel.style.fontSize = '13px';
      valueLabel.style.padding = '10px 0px 1px 10px';
      valueLabel.style.margin = '0px';
      valueLabel.style.textAlign = 'left';
      mxUtils.write(valueLabel, "Live property value");
      propContainer.appendChild(valueLabel);
      
      const valueContent = document.createElement("input");
      valueContent.type = "text";
      valueContent.style.border = "1px solid rgb(112, 112, 112)";
      valueContent.style.borderRadius = "3px";
      valueContent.style.padding = '0px';
      valueContent.style.margin = '0px';
      propContainer.appendChild(valueContent);
      
      const validationBtn = document.createElement("button");
      validationBtn.style.display = "block";
      validationBtn.style.textAlign = "center";

      validationBtn.style.margin = "auto";
      validationBtn.style.marginTop = "10px";

      mxUtils.write(validationBtn, "ADD LIVE PROPERTY");
      propContainer.appendChild(validationBtn);

      validationBtn.onclick = function() {
        const {currentSelectedId} = live.formatPanel;
        const graph = ui.editor.getGraphXml()
        const targettedNode = mxUtils.findNode(
          graph,
          "id",
          currentSelectedId
        );
        targettedNode.setAttribute(
          live.property.prefix + nameContent.value,
          valueContent.value
        );
        ui.editor.setGraphXml(graph);
        toggleLiveFormatPanel();
        toggleLiveFormatPanel();
      }
      return propContainer;
    }
  }
);