/**
 * Live Update plugin.
 * 
 * Allows you to update separately each selected graph element.
 * Use live attributes to configure the plugin.
 * 
 * In the metadata of the diagram (graph element with id = 0)
 *    - LIVE_API: url prefix to request the distant API (optional, see below).
 *    - LIVE_REFRESH: interval between 2 updates, set in seconds (optional, 
 *      default is 10s).
 * 
 * In the graph objects properties (right click > "Edit Data" or 
 * CTRL+M):
 *    - LIVE_DATA: calls a complex API (returning an object)
 *    - LIVE_TEXT: updates element text node.
 *    - LIVE_STYLE: updates element style.
 *    - live.property.<PROPERTY_NAME>: updates element <PROPERTY_NAME> value.
 *        Example: "live.property.fillOpacity" updates "Fill Opacity" element 
 *        property.
 * 
 * See documentation for more details.
 */
Draw.loadPlugin(
  function(ui) {
    const LIVE_USERNAME = "live.username";
    const LIVE_APIKEY = "live.apikey";
    const LIVE_PASSWORD = "live.password";
    const LIVE_API = "live.api";
    const LIVE_APITYPE = "live.apitype";
    const LIVE_REFRESH = "live.refresh";
    const LIVE_STYLE = "live.style";
    const LIVE_TEXT = "live.text";
    const LIVE_DATA = "live.data";
    const LIVE_SOURCE = "live.source";
    const LIVE_REF = "live.ref";

    const live = {
      pageBaseId: undefined,
      thread: null,
      timeout: 0,
      isInit: false,
      nodes: [],
      apitypes: [
        { id: "elastic", source: "hits.hits[0]._source" },
        { id: "hastat", post: hastatBuildObject }
      ],
      property: {
        prefix: "live.property.",
        getName: (fullPropName) => fullPropName.slice(live.property.prefix.length)
      },
      /**
       * Checks if targetted live attribute is a complex one 
       * (with js instructions) or if it is a simple one (containing an url)
       * @param {string} attribute Targetted attribute value
       * @returns {boolean} true if attribute is complex
       */
      isComplexAttribute: (attribute) => attribute.startsWith("="),
      
      /**
       * Checks if targetted live attribute handles an anonymous api
       * receiving the updates value or if it contains js instructions
       * to fetch updated value managing named APIs
       * @param {string} attribute Targetted attribute value
       * @returns {boolean} true if attribute references an anonymous API
       */
      isAnonAttribute: (attribute) => !attribute.startsWith("="),
      
      /**
       * Checks if targetted attribute is a live attribute
       * @param {string} attribute Targetted attribute name
       * @returns {boolean} true if attribute is live
       */
      isLiveAttribute: (attribute) => attribute.startsWith("live."),

      /**
       * Chacks if targetted attribute corresponds to an object's live property
       * @param {string} attribute Targetted attribute name
       * @returns {boolean} true if attribute is an object's live property
       */
      isLiveProperty: (attribute) => attribute.startsWith(live.property.prefix),

      /**
       * Checks if targetted attribute is a live attribute & if it's not an unavailable one
       * @param {string} attribute Targetted attribut ename
       * @returns {boolean} True if attribute is an available live one
       */
      isAvailableLiveAttribute: (attribute) => {
        if(!live.isLiveAttribute(attribute)) return false;
        else {
          for(const unavailableLiveAttribute of live.unavailables) {
            if(attribute === unavailableLiveAttribute) return false;
          }
          return true;
        }
      },
      mxUtilsRequestErrorMsg: "{\"status\": \"error\"}",
      formatPanel: {
        arePropertiesShown: false,
        isDisplayed: false,
      },
      all: [
        LIVE_USERNAME,  // "username" credential
        LIVE_APIKEY,    // "apikey" credential
        LIVE_PASSWORD,  // "password" credential
        LIVE_API,       // root url
        LIVE_APITYPE,   // if set, corresponds to a specific API (LIVE_SOURCE is autoset)
        LIVE_REFRESH,   // time between 2 API calls in seconds
        LIVE_STYLE,     // graph node's style
        LIVE_TEXT,      // graph node's text
        LIVE_DATA,      // Graph node API
        LIVE_SOURCE     // path from received API response to get source object (autoset if LIVE_APITYPE is set)
      ],
      credentials: [LIVE_USERNAME, LIVE_PASSWORD, LIVE_APIKEY],
      unavailables: [
        LIVE_API,
        LIVE_REFRESH,
        LIVE_USERNAME,
        LIVE_APIKEY,
        LIVE_PASSWORD,
        LIVE_DATA,
        LIVE_SOURCE,
        LIVE_APITYPE
      ]
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
        ui.editor.addListener("fileLoaded", function(e) {
          // Inits live features on page wake & prevents multi loads
          if(!ui.isLivePluginEnabled) {
            ui.isLivePluginEnabled = true;
            live.pageBaseId = ui.currentPage.root.getId();
            addLiveUpdatePalette();
            addLiveTabToFormatPanel();
            overrideFormatPanelRefresh();
          }

          // Adds a listener to stop the ongoing update process if page changed
          ui.editor.addListener(mxUtils.CHANGE, function() {
            if(ui && ui.currentPage && ui.currentPage.root) {
              const currentPageBaseId = ui.currentPage.root.getId();
              if(live.pageBaseId !== currentPageBaseId) {
                if(live.thread) log("Refresh feature stopped due to graph page change");
                resetScheduleUpdate();
              }
            }
          });
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
      const formatTabs = formatContainer.firstChild;
      if(!formatTabs) return;
      const formatWidth = parseInt(formatContainer.style.width);
      const formatTabsMax = ui.editor.graph.isSelectionEmpty() ? 3 : 4;
      const formatTabsNb = formatTabs.childNodes.length;
      if(formatTabsNb >= formatTabsMax) return;

      // Adds tab only if formatWidth > 0 === format panel is displayed
      if(formatWidth > 0) {
        const tabLength = parseInt(formatWidth / (formatTabsNb + 1));
        for(const tab of formatTabs.children) {
          tab.style.width = tabLength + "px";
        }

        /**
         * Sets Format Panel tab style, depending 
         * on if current tab is focused one or not
         * @param {HTMLElement} elt Format Panel tab
         * @param {boolean} isActiveTab True if selected tab is active one
         */
        function setTabStyle(elt, isActiveTab = false) {
          if(isActiveTab) elt.style.backgroundColor = "inherit";
          else elt.style.backgroundColor = ui.format.inactiveTabBackgroundColor;

          elt.style.borderWidth = "0px";
          elt.style.borderLeftWidth = "1px";
          elt.style.borderBottomWidth = isActiveTab ? "0px" : "1px";
        }

        const liveTab = formatTabs.firstChild.cloneNode(false);
        liveTab.style.width = tabLength;
        setTabStyle(liveTab);
        mxUtils.write(liveTab, "Live");
        formatTabs.appendChild(liveTab);

        /**
         * Listener called at "click" on format panel tabs  
         * Displays Live Format Panel if liveTab is clicked
         * @param {HTMLElement} targettedTab Format Panel clicked tab
         */
        function handleLiveFormatPanelDisplay(targettedTab, liveContent) {
          if(targettedTab === liveTab) {
            // selected tab is Live => display Live Format Panel
            live.formatPanel.isDisplayed = true;
            liveContent.style.display = "block";
            formatContainer.appendChild(liveContent);

            for(const tab of formatTabs.children) {
              setTabStyle(tab, tab === liveTab);
            }

            for(const content of formatContainer.childNodes) {
              if(content !== formatTabs) {
                if(content === liveContent) content.style.display = "block";
                else content.style.display = "none";
              }
            }
          } else {
            // Hides Live panel & display selected one
            live.formatPanel.isDisplayed = false;
            setTabStyle(liveTab);
            liveContent.style.display = "none";

            // Sets focused tab style & displays its content
            const tabs = Array.from(formatTabs.childNodes);
            if(tabs) {
              const focusedTabId = tabs.findIndex(tab => (tab === targettedTab));
              if(ui.format.panels[focusedTabId]) {
                ui.format.panels[focusedTabId].container.style.display = "block";
                setTabStyle(targettedTab, true);
              }
            }
          }
        }

        const liveContent = buildLiveFormatPanelContent();
        if(liveContent) {
          if(live.formatPanel.isDisplayed) {
            handleLiveFormatPanelDisplay(liveTab, liveContent);
          }
  
          mxEvent.addListener(formatTabs, "click", function(e) {
            handleLiveFormatPanelDisplay(e.target, liveContent);
          });
        }
      }
    }

    /** Overrides format panel reshresh event to add Live tab */
    function overrideFormatPanelRefresh() {
      const formatRefreshBasicFunc = ui.format.refresh;
      ui.format.refresh = function() {
        mxUtils.bind(ui.format, formatRefreshBasicFunc)();
        if(!ui.editor.graph.isEditing()) addLiveTabToFormatPanel();
      }
    }

    /** Builds content in Live Format Panel */
    function buildLiveFormatPanelContent() {
      const graphXml = ui.editor.getGraphXml();
      const graph = ui.editor.graph;
      const liveFormatPanelContainer = document.createElement('section');

      let targetId = undefined;
      if(graph.isSelectionEmpty()) targetId = live.pageBaseId;
      else targetId = graph.selectionModel.cells[0].getId();
      const target = mxUtils.findNode(graphXml, "id", targetId);
      if(!target) return;
      const isSelectionMode = !graph.isSelectionEmpty();

      /**
       * Builds an input section in the Live format panel
       * @param {string} text Displayed label
       * @param {string} attrName Input's corresponding live attribute
       * @param {string} targetId Targetted graph node id
       * @returns {object} Set of all HTML elements for the input
       */
      function buildInput(text, attrName, target) {
        if(!target) return {cb: null, shortField: null, longField: null, label: null};
        const targetId = target.getAttribute("id");
        const emptyValue = "";
        const base = mxUtils.findNode(graphXml, "id", live.pageBaseId);
        const attrValue = target.getAttribute(attrName) || null;

        const cb = document.createElement('input');
        cb.setAttribute('type', 'checkbox');
        cb.style.margin = '3px 3px 0px 0px';
        cb.checked = attrValue;
        cb.title = (cb.checked ? "Remove" : "Add") + " attribute";

        const label = document.createElement("label");
        label.style.textOverflow = "ellipsis";
        mxUtils.write(label, text);

        /**
         * Creates an input or textarea field depending on hrmlTag value
         * @param {string} htmlTag HTML node name
         * @returns {HTMLElement} Created node
         */
        function createField(htmlTag) {
          const elt = document.createElement(htmlTag);
          elt.value = attrValue;
          elt.style.boxSizing = "border-box";
          elt.style.margin = "0";
          elt.style.padding = "0";
          elt.style.border = "1px solid " + ui.format.inactiveTabBackgroundColor;
          elt.style.borderRadius = "0px";
          elt.style.fontStyle = (attrValue) ? "normal" : "italic";
          elt.style.backgroundColor = "white";
          if(htmlTag === "input") {
            elt.style.width = live.isLiveProperty(attrName) ? "55%" : "60%";
            elt.type = "text";
            elt.style.height = "20px";
            elt.style.float = "right";
            elt.style.marginLeft = "auto";
          } else if(htmlTag === "textarea") {
            elt.style.width = "100%";
            elt.rows = 5;
            elt.style.resize = "vertical";
            elt.style.display = "none";
            elt.style.outline = "none";
          }
                  
          /**
           * Computes placeholder for "source" live format panel input.
           * Checks depend on nodes **LIVE_APITYPE** & **LIVE_SOURCE** attributes
           * @param {Node} target Targetted graph node 
           * @param {Node} base Graph base node
           * @returns {string} Computed placeholder or default empty value
           */
          function getSourcePlaceholder(target, base) {
            /**
             * Computes source placeholder depending on 
             * checked node **LIVE_APITYPE** attribute value
             * @param {Node} elt Current checked node
             */
            function checkApitype(elt) {
              if(elt.hasAttribute(LIVE_APITYPE)) {
                const apiType = live.apitypes.find(
                  (api) => (api.id === elt.getAttribute(LIVE_APITYPE))
                );

                if(apiType) {
                  return `api ${apiType.id} => ${apiType.source || "Function"}`;
                }
              }
              return false;
            }

            if(checkApitype(target)) return checkApitype(target);
            else if(checkApitype(base)) return checkApitype(base);
            else if(base.hasAttribute(LIVE_SOURCE)) return base.getAttribute(LIVE_SOURCE);
            else return emptyValue;
          }

          if (attrName === LIVE_APITYPE) {
            elt.placeholder = "raw";
          }
          else if(attrName === LIVE_SOURCE) {
            elt.placeholder = getSourcePlaceholder(target, base);
          }
          else if(base.hasAttribute(attrName)) {
            elt.placeholder = base.getAttribute(attrName);
          }
          else elt.placeholder = emptyValue;
            
          return elt;
        }

        const shortField = createField("input");
        const longField = createField("textarea");

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
          const initialValue = target.getAttribute(attrName) || "";
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

        return { cb, label, longField, shortField };
      }

      /**
       * Builds inputs then appends its to the Live format panel container
       * @param {Array<object>} inputsList List of data for the input build
       * @param {HTMLElement} container Inputs HTML container
       * @param {Node} targetId Targetted graph node
       */
      function handleSubpanelInputs(container, target, inputsList) {
        for(const input of inputsList) {
          const [text, attributeName] = input;

          const inputSection = document.createElement('section');
          inputSection.style.padding = '6px 0px 1px 1px';
          inputSection.style.whiteSpace = 'nowrap';
          inputSection.style.overflow = 'hidden';
          inputSection.style.fontWeight = "normal";
          inputSection.style.display = "flex";
          inputSection.style.flexWrap = "wrap";
          inputSection.style.justifyContent = "flex-start";
          inputSection.style.alignItems = "center";

          const {cb, shortField, longField, label} = buildInput(
            text,
            attributeName,
            target
          );

          inputSection.append(cb, label, shortField, longField);
          container.appendChild(inputSection);
        }
      }

      /**
       * Builds a subpanel in the Live Format Panel
       * @param {string} title Subpanel title
       * @param {Node} target Targetted graph node
       * @param {boolean} isSelectionMode True if a node is selected in the graph
       * @returns The built subpanel
       */
      function buildSubpanel(title, target, isSelectionMode = false) {
        const subpanelContainer = new BaseFormatPanel().createPanel();
        subpanelContainer.style.padding = "12px";
        const titleContainer = new BaseFormatPanel().createTitle(title);
        titleContainer.style.width = "100%";
        subpanelContainer.appendChild(titleContainer);

        if(title !== "Properties") {  
          const baseInputs = [
            ["API", LIVE_API],
            ["API Type", LIVE_APITYPE],
            ["Username", LIVE_USERNAME],
            ["Password", LIVE_PASSWORD],
            ["API Key", LIVE_APIKEY],
            ["Source", LIVE_SOURCE],
            ["Refresh", LIVE_REFRESH],
          ];
          const graphNodeInputs = [ 
            // Displayed only if a node is selected in the graph
            ["Object", LIVE_DATA],
            ["Text", LIVE_TEXT],
            ["Style", LIVE_STYLE],
          ];

          handleSubpanelInputs(subpanelContainer, target, baseInputs);
          if(isSelectionMode) {
            handleSubpanelInputs(subpanelContainer, target, graphNodeInputs);
          }
        } else {
          const propertyInputs = [];
          for(const attr of target.attributes) {
            if(live.isLiveProperty(attr.name)) {
              const newLiveProperty = [
                live.property.getName(attr.name),
                attr.name
              ];
              propertyInputs.push(newLiveProperty);
            }
          }
          handleSubpanelInputs(subpanelContainer, target, propertyInputs);
        }
        return subpanelContainer;
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

        function validateForm() {
          const nameFieldIsEmpty = (inputs.name.value === "");
          const valueFieldIsEmpty = (inputs.value.value === "");

          if ((!nameFieldIsEmpty) && (!valueFieldIsEmpty)) {
            updateLiveAttrInFormatPanel(
              targetId, 
              live.property.prefix + inputs.name.value.trim(),
              inputs.value.value.trim()
            );
            inputs.name.value = "";
            inputs.value.value = "";
          }
          else {
            if(nameFieldIsEmpty) {
              log("New property must have a name !");
            }
            if(valueFieldIsEmpty) {
              log("New property must have a value !");
            }
          }
        }

        function handleKeyDownOnInput(e) {
          if(e.key === "Enter") validateForm();
        }

        mxEvent.addListener(validateBtn, mxEvent.CLICK, validateForm);
        mxEvent.addListener(inputs.name, "keydown", handleKeyDownOnInput);
        mxEvent.addListener(inputs.value, "keydown", handleKeyDownOnInput);

        formContainer.appendChild(validateBtn);
        return formContainer;
      }

      liveFormatPanelContainer.appendChild(
        buildSubpanel(
          (targetId === live.pageBaseId) ? "Diagram" : "Object " + targetId,
          target,
          isSelectionMode
        )
      );

      if(isSelectionMode) {
        liveFormatPanelContainer.append(
          buildSubpanel("Properties", target),
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
      const target = mxUtils.findNode(graphXml, "id", targetId);
      const msg = {prop: "Property " + attributeName + " "};

      if(attributeValue) {
        target.setAttribute(attributeName, attributeValue);
        msg.action = "added on ";
      } else {
        target.removeAttribute(attributeName);
        msg.action = "removed from ";
      }

      ui.editor.setGraphXml(graphXml);
      ui.editor.graph.selectionModel.changeSelection(selectedCells);

      if(targetId === live.pageBaseId) msg.obj = "graph base";
      else msg.obj = "object with id " + targetId;

      log(msg.prop + msg.action + msg.obj);
      resetScheduleUpdate();
    }

    /**
     * Fetches the selected attribute value from computed exploitable API response
     * @param {object} exploitableData Parsed received response with 
     * @param {string} instructions js instructions list to retrieve value
     * @returns {string} selected attribute updated value 
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
     * @param {object} computationDataset Required data to compute exploitable data from API raw response
     * @returns computed exploitable data
     */
    function buildExploitableData(raw, computationDataset = {}) {
      const {source, post, apitypeId} = computationDataset;
      const postProcessed = (post) ? post(raw) : raw;
      
      if (post && !postProcessed) throw Error(
        "'post' function for apitype " + apitypeId + 
        " can't compute an exploitable object"
      );

      const exploitable = new Function(
        "rawResponse",
        `return rawResponse${(source) ? "." + source : ""};`
      )(postProcessed);

      if(!exploitable) {
        const withPost = (post) ? "after " + apitypeId + " post process" : "";
        const withSource = (source) ? "with given path: " + source : "";
        throw Error(`No data available from API ${withPost} ${withSource}`);
      }

      return exploitable;
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
      live.pageBaseId = ui.currentPage.root.getId();
      clearThread(live.thread);
    }

    /** "live-restart" action handler */
    function restartScheduleUpdate() {
      resetScheduleUpdate();
      startScheduleUpdate();
    }

    /**
     * Gets credentials to perform requests to a distant api requiring authentication.  
     * Use live base credentials data if url is prefixed by base's **LIVE_API** attribute,
     * otherwise use targetted graph node live attributes
     * @param {Node} target Targetted graph node
     * @param {Node} base Graph node with id = 0
     * @returns {object|undefined} credentials if exist or "undefined"
     */
    function getCredentials(target, base) {
      const credentials = {};
      for(const crd of live.credentials) {
        if(target.getAttribute(crd)) credentials[crd.slice(5)] = target.getAttribute(crd);
        else credentials[crd.slice(5)] = base.getAttribute(crd);
      }
      return (credentials.username || credentials.apikey) ? credentials : undefined;
    }

    /**
     * Computes the url to request the corresponding API
     * @param {string} url Value stored in live attribute
     * @param {string} baseApi Value for **LIVE_API** attribute stored in base node (with id = 0)
     * @param {string} targetApi Value for **LIVE_API** attribute stored in current handled object
     * @returns {string} The computed request url 
     */
    function buildUrl(url, baseApi, targetApi) {
      let request = "";
      if(url) {
        if(url.startsWith("http")) {
          request = url;
        } else if(url.startsWith("/")) {
          if(targetApi) {
            request = targetApi + url;
          } else {
            request = baseApi + url;
          }
        } else {
          request = null;
        }
      } else {
        if(targetApi) request = targetApi;
        else if(baseApi) request = baseApi;
        else request = null;
      }

      if(request === null) throw Error("url pattern is wrong", url);
      return request;
    }

    /**
     * Checks recursively in xml tree & stores nodes containing live attributes
     * @param {Node} graphElement Current checked graph node
     * @param {Array} liveNodes List of identified graph live nodes
     */
    function findLiveNodes(graphElement, liveNodes = []) {
      // base not is not checked
      if(graphElement.getAttribute("id") !== live.pageBaseId) {
        const elementId = graphElement.getAttribute("id");

        // checks if current node is live
        let isLiveElement = false;
        for (const attribute of graphElement.attributes) {
          // if(attribute.name.startsWith("live.")) {
          if(live.isLiveAttribute(attribute.name)) {
            isLiveElement = true;
            break;
          }
        }

        // stores element id if element is live
        if(isLiveElement) {
          const liveNode = { graphNodeId: elementId, graphNode: graphElement };
          if(graphElement.nodeName === "mxCell") liveNode.isCell = true;
          liveNodes.push(liveNode);
        }
      }

      // if current element has children, finds live children
      if(graphElement.children.length > 0) liveNodes = findLiveNodes(
        graphElement.firstChild, 
        liveNodes
      );

      // performs check for sibling
      const sibling = graphElement.nextElementSibling;
      if(sibling !== null) liveNodes = findLiveNodes(sibling, liveNodes);
      
      return liveNodes;
    }

    /**
     * Computes path to access data from request response depending on stored
     * apitypes targetted with its id stored in **LIVE_APITYPE** attributes,
     * or with **LIVE_SOURCE** attributes in object & graph base
     * @param {Node} target Current handled graph node
     * @param {Node} base Graph base node
     * @returns {object} Object containing data to  Path from or method to transform corresponding api response in order to get an exploitable object
     */
    function getDataToFinalizeResponse(target, base) {
      /**
       * Gets data if "live.apitype" attribute is set in selected node
       * @param {Node} currentNode Current selected node
       * @param {string} currentSource Value for "live.source" attribute in currentNode
       * @returns {object} Dataset required to get exploitable data from API response
       */
      function getFromApitype(currentNode, currentSource) {
        const apitype = currentNode.getAttribute(LIVE_APITYPE);
        if(!apitype) return false;

        const targettedApi = live.apitypes.find(api => api.id === apitype);
        if(!targettedApi) {
          log(
            "Value set in apitype (" 
            + apitype 
            + ") in object with id " 
            + currentNode.getAttribute("id")
            +" does not match any identified apitype"
          );
          return false;
        }

        return {
          apitypeId: targettedApi.id,
          post: targettedApi.post,
          source: (currentSource) ? currentSource : targettedApi.source
        };
      }
      const targetSource = target.getAttribute(LIVE_SOURCE);
      const baseSource = base.getAttribute(LIVE_SOURCE);

      if(getFromApitype(target, targetSource))    return getFromApitype(target, targetSource);
      else if(targetSource)                       return {source: targetSource};
      else if(getFromApitype(base, baseSource))   return getFromApitype(base, baseSource);
      else if(baseSource)                         return {source: baseSource};
      else                                        return undefined; 
    }

    /**
     * Adds to the graph object update node the 
     * updated value for corresponding attribute
     * @param {Node} updateNode XML node containing graph object update data
     * @param {string} attrName Graph object attribute name
     * @param {string} attrValue Graph object attribute updated value
     * @param {string} initialTargetStyle Targetted graph node style before update
     */
    function fillUpdateNode(updateNode, attrName, attrValue, initialTargetStyle) {
      if(attrName === LIVE_TEXT) {
        updateNode.setAttribute(
          "value", 
          `<object label="${attrValue}"/>`
        );
      } else if (attrName === LIVE_STYLE) {
        updateNode.setAttribute(
          "style", 
          attrValue
        );
      } else {
        // Checks if style has already been updated by another attribute 
        let currentStyle = undefined;
        if(updateNode.hasAttribute("style")) {
          currentStyle = updateNode.getAttribute("style");
        } else {
          currentStyle = initialTargetStyle;
        }
        const updatedStyle = mxUtils.setStyle(
          currentStyle,
          live.property.getName(attrName), 
          attrValue
        );
        updateNode.setAttribute("style", updatedStyle);
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
      /** 
       * Sets value for Authorization request header to access a protected API
       * @param {object} credentials Object containing request credentials
       * @returns {string} Value for the header
       */
      function getAuthorizationValue(credentials) {
        const {username, password, apikey} = credentials;

        if (username && password) {
          return "Basic " + btoa(`${username}:${password}`);
        } else if(apikey) {
          return "Bearer " + apikey;
        } else throw Error("Credentials malformed");
      }
      try {
        let response = undefined;
        if(credentials) {
          const authorization = getAuthorizationValue(credentials);

          const xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.withCredentials = true;

          const headers = [
            ["Authorization", authorization]
          ];

          for(const header of headers) {
            const [name, value] = header;
            xhr.setRequestHeader(name, value);
          }

          xhr.onreadystatechange = function() {
            if(xhr.readyState === 4) {
              if(xhr.status >= 200 && xhr.status < 300) {
                response = xhr.responseText.trim();
              } else {
                throw Error("Request failed");
              }
            }
          }
          
          xhr.send();
        } else {
          response = mxUtils.load(url).getText().trim();
          if(response === live.mxUtilsRequestErrorMsg) {
            throw Error("No response received from request");
          }
        }

        if(isSimpleResponse) return response.replace(/"/g, "").trim();
        else return JSON.parse(response);
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
      const output = [];
      for (const e1 of json) {
        const t = [];
        for (const e2 of e1) t[e2.field.name] = e2.value.value;
        if(!output[t["pxname"]]) output[t["pxname"]] = [];
        output[t["pxname"]][t["svname"]] = t;
      }
      return output;
    }

    /**
     * Handles case of mxCell containing live attributes without a parent object.  
     * Moves live attributes from containing mxCell to its \<userObject> parent created by update process 
     * @param {string} cellId Live cell's
     */
    function upgradeCellLiveNode(cellId) {
      const graphXml = ui.editor.getGraphXml();
      const parent = mxUtils.findNode(graphXml, "id", cellId);
      const cell = parent.firstChild;

      for(const liveAttribute of live.all) {
        if(cell.hasAttribute(liveAttribute)) {
          parent.setAttribute(liveAttribute, cell.getAttribute(liveAttribute));
          cell.removeAttribute(liveAttribute);
        }
      }
      ui.editor.setGraphXml(graphXml);
    }

    /** Performs an update process */
    function doUpdate() {
      clearThread(live.thread);
      const graphXml = ui.editor.getGraphXml();
      const baseNode = mxUtils.findNode(graphXml, "id", live.pageBaseId);
      if(!live.isInit) {
        live.timeout = (+(baseNode.getAttribute(LIVE_REFRESH) + "000")) || 10000;
        live.nodes = findLiveNodes(graphXml);
        live.isInit = true;
      }

      // Initiates the xml doc to perform the updates 
      // & the array which stores data for complex APIs
      const xmlUpdatesDoc = mxUtils.createXmlDocument();
      const updatesList = xmlUpdatesDoc.createElement("updates");
      const apiResponses = [];
  
      for(const {graphNode, graphNodeId} of live.nodes) {
        if(!graphNodeId) continue;
        // Creates an update node which stores updates for all targetted live nodes
        const updateNode = xmlUpdatesDoc.createElement("update");
        updateNode.setAttribute("id", graphNodeId);

        // Gets selected graph node's style to prevent style rewriting
        const style = (
          graphNode.firstChild.getAttribute("style") || 
          graphNode.getAttribute("style")
        );

        graphNode.attributes.forEach(({name: attrName, value: attrValue}) => {
          // Targets attribute if attribute is valid live one
          if(live.isAvailableLiveAttribute(attrName)) {
            try {
              const isComplexAttr = live.isComplexAttribute(attrValue);
              const attributeUrl = (isComplexAttr) ? graphNode.getAttribute(LIVE_DATA):attrValue;

              const url = buildUrl(
                attributeUrl,
                baseNode.getAttribute(LIVE_API),
                graphNode.getAttribute(LIVE_API)
              );

              const targettedApi = apiResponses.find(res => res.url === url);
              let updatedAttrValue = (targettedApi) ? targettedApi.response : undefined;

              if(!targettedApi) {
                const credentials = getCredentials(graphNode, baseNode);
                const rawResponse = computeApiResponse(
                  url, 
                  !isComplexAttr,
                  credentials
                );

                // Fetches & computes API complex response if not already stored
                if(isComplexAttr) {
                  const dataset = getDataToFinalizeResponse(graphNode, baseNode);
                  updatedAttrValue = buildExploitableData(rawResponse, dataset);
                } else updatedAttrValue = rawResponse;
                
                apiResponses.push({ url, response: updatedAttrValue });
              }

              if(isComplexAttr) {
                updatedAttrValue = fetchAttrValueFromExploitableData(
                  updatedAttrValue,
                  attrValue.slice(1)
                );
              }

              fillUpdateNode(updateNode, attrName, updatedAttrValue, style);
            } catch(e) {
              log(
                "Graph object id:", graphNodeId,
                "| Attribute:", attrName,
                "\n", e.message
              );
            }
          }
        });
        updatesList.appendChild(updateNode);
      }
      // Appends "updates" filled node to the new doc & updates diagram
      xmlUpdatesDoc.appendChild(updatesList);
      ui.updateDiagram(mxUtils.getXml(xmlUpdatesDoc));

      /** Upgrades unwrapped graph live nodes */ 
      live.nodes.forEach(liveNode => {
        if(liveNode.isCell) {
          upgradeCellLiveNode(liveNode.graphNodeId);
          delete liveNode.isCell;
        }
      });
      live.thread = setTimeout(doUpdate, live.timeout);
    }

    function log(...text) {
      console.log("liveUpdate plugin:", ...text);
    }
    initPlugin();
  }
);
