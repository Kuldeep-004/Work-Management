import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import defaultProfile from "../assets/avatar.jpg";
import FileUpload from "./FileUpload";
import FileList from "./FileList";
import { API_BASE_URL } from "../apiConfig";
import TaskStatusDropdown from "./TaskStatusDropdown";
import ITRProgressTable from "./ITRProgressTable";

// Accept new props for edit mode
const CreateTask = ({
  users = [],
  mode = "create",
  initialData = null,
  isOpen = false,
  onClose = () => {},
  onSubmit = null,
  showAcceptButton = false,
  hideFileSection = false,
  selectedUserId = null, // Selected user from tasks page dropdown
}) => {
  const { user: loggedInUser, isAuthenticated } = useAuth();
  const [isWorkTypeModalOpen, setIsWorkTypeModalOpen] = useState(false);
  const [workTypeFormData, setWorkTypeFormData] = useState({ name: "" });
  const [clients, setClients] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    clientName: "",
    clientGroup: "",
    workType: [],
    assignedTo: [],
    assignedBy: "", // Add assignedBy field
    guides: [], // Add guides field
    priority: "",
    inwardEntryDate: "",
    inwardEntryTime: "",
    dueDate: "",
    targetDate: "",
    billed: false, // default to No (Internal Works)
    status: "yet_to_start", // default to yet_to_start
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedGuides, setSelectedGuides] = useState([]); // Add selected guides state
  const [selectedAssignedBy, setSelectedAssignedBy] = useState(null); // Add selected assignedBy state
  const [searchTerm, setSearchTerm] = useState("");
  const [guideSearchTerm, setGuideSearchTerm] = useState(""); // Add guide search term
  const [assignedBySearchTerm, setAssignedBySearchTerm] = useState(""); // Add assignedBy search term
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isGuideDropdownOpen, setIsGuideDropdownOpen] = useState(false); // Add guide dropdown state
  const [isAssignedByDropdownOpen, setIsAssignedByDropdownOpen] =
    useState(false); // Add assignedBy dropdown state
  const assignSearchInputRef = useRef(null);
  const guideSearchInputRef = useRef(null); // Add guide search ref
  const assignedBySearchInputRef = useRef(null); // Add assignedBy search ref
  // Focus the Assign To search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && assignSearchInputRef.current) {
      assignSearchInputRef.current.focus();
    }
  }, [isDropdownOpen]);
  // Focus the Guide search input when dropdown opens
  useEffect(() => {
    if (isGuideDropdownOpen && guideSearchInputRef.current) {
      guideSearchInputRef.current.focus();
    }
  }, [isGuideDropdownOpen]);
  // Focus the AssignedBy search input when dropdown opens
  useEffect(() => {
    if (isAssignedByDropdownOpen && assignedBySearchInputRef.current) {
      assignedBySearchInputRef.current.focus();
    }
  }, [isAssignedByDropdownOpen]);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const modalRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [taskFiles, setTaskFiles] = useState([]);
  const [createdTaskId, setCreatedTaskId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);
  const [isWorkTypeDropdownOpen, setIsWorkTypeDropdownOpen] = useState(false);
  const [workTypeSearchTerm, setWorkTypeSearchTerm] = useState("");
  const [isMultiUserAssign, setIsMultiUserAssign] = useState(false); // Toggle for multi-user assignment
  const [isMultiWorkTypeAssign, setIsMultiWorkTypeAssign] = useState(false);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (increased from 10MB)
  const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB (increased from 50MB)
  const MAX_FILES = 10;

  // Function to get current date and time in required format
  const getCurrentDateTime = () => {
    const now = new Date();

    // Format date as YYYY-MM-DD
    const date = now.toISOString().split("T")[0];

    // Format time as HH:MM in 12-hour format
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const time = `${displayHours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")} ${ampm}`;

    return { date, time };
  };

  // Function to convert 12-hour time to 24-hour format for backend
  const convertTo24Hour = (time12h) => {
    const [time, modifier] = time12h.split(" ");
    let [hours, minutes] = time.split(":");

    hours = parseInt(hours, 10);

    if (hours === 12) {
      hours = modifier === "PM" ? 12 : 0;
    } else if (modifier === "PM") {
      hours = hours + 12;
    }

    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  };

  // Function to convert 24-hour time to 12-hour format for display
  const convertTo12Hour = (time24h) => {
    const [hours, minutes] = time24h.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour.toString().padStart(2, "0")}:${minutes} ${ampm}`;
  };

  // Fetch clients, client groups, work types, and priorities
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch clients
        const clientsResponse = await fetch(`${API_BASE_URL}/api/clients`, {
          headers: {
            Authorization: `Bearer ${loggedInUser.token}`,
          },
        });
        const clientsData = await clientsResponse.json();
        setClients(clientsData);

        // Fetch client groups
        const groupsResponse = await fetch(
          `${API_BASE_URL}/api/clients/groups`,
          {
            headers: {
              Authorization: `Bearer ${loggedInUser.token}`,
            },
          },
        );
        const groupsData = await groupsResponse.json();
        setClientGroups(groupsData);

        // Fetch work types
        const workTypesResponse = await fetch(
          `${API_BASE_URL}/api/clients/work-types`,
          {
            headers: {
              Authorization: `Bearer ${loggedInUser.token}`,
            },
          },
        );
        const workTypesData = await workTypesResponse.json();
        setWorkTypes(workTypesData);

        // Fetch priorities and merge with defaults
        try {
          const prioritiesResponse = await fetch(
            `${API_BASE_URL}/api/priorities`,
            {
              headers: {
                Authorization: `Bearer ${loggedInUser.token}`,
              },
            },
          );
          const prioritiesData = await prioritiesResponse.json();
          setPriorities(prioritiesData);
        } catch (priorityError) {
          console.error("Error fetching priorities:", priorityError);
          setPriorities([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch required data");
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, loggedInUser]);

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm) return clients;
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
        (client.group &&
          client.group.name
            .toLowerCase()
            .includes(clientSearchTerm.toLowerCase())),
    );
  }, [clients, clientSearchTerm]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target) &&
        !event.target.closest(".work-type-modal")
      ) {
        onClose();
        setIsDropdownOpen(false);
        setIsClientDropdownOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const validateFiles = (files) => {
    const newFiles = Array.from(files);
    const errors = [];

    // Check total number of files
    if (selectedFiles.length + newFiles.length > MAX_FILES) {
      errors.push(
        `Maximum ${MAX_FILES} files allowed. You are trying to add ${newFiles.length} file(s) but already have ${selectedFiles.length}.`,
      );
    }

    // Check individual file sizes and total size
    let totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    newFiles.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(
          `${file.name} is ${(file.size / 1024 / 1024).toFixed(
            2,
          )}MB and exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        );
      }
      totalSize += file.size;
    });

    if (totalSize > MAX_TOTAL_SIZE) {
      errors.push(
        `Total size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds ${
          MAX_TOTAL_SIZE / 1024 / 1024
        }MB limit`,
      );
    }

    // Check file types
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg",
      "image/png",
      "image/gif",
      "text/plain",
    ];

    newFiles.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name} (${file.type}) is not a supported file type`);
      }
    });

    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error, { duration: 5000 }));
      return false;
    }

    return true;
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert FileList to Array and validate
    const newFiles = Array.from(files);
    console.log("Selected files:", newFiles); // Debug log

    if (validateFiles(newFiles)) {
      setSelectedFiles((prev) => {
        const updatedFiles = [...prev, ...newFiles];
        console.log("Updated selected files:", updatedFiles); // Debug log
        return updatedFiles;
      });
    }
    // Reset the input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Prefill formData if in edit mode
  useEffect(() => {
    if (mode === "edit" && initialData && isOpen) {
      let inwardEntryTime = "";
      if (initialData.inwardEntryTime) {
        inwardEntryTime = initialData.inwardEntryTime;
      } else if (initialData.inwardEntryDate) {
        const dateObj = new Date(initialData.inwardEntryDate);
        const hours = dateObj.getHours().toString().padStart(2, "0");
        const minutes = dateObj.getMinutes().toString().padStart(2, "0");
        inwardEntryTime = `${hours}:${minutes}`;
      }
      const convertedTime = inwardEntryTime
        ? convertTo12Hour(inwardEntryTime)
        : "";
      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        clientName: initialData.clientName || "",
        clientGroup: initialData.clientGroup || "",
        workType: Array.isArray(initialData.workType)
          ? initialData.workType
          : [],
        assignedTo: Array.isArray(initialData.assignedTo)
          ? initialData.assignedTo.map((u) =>
              typeof u === "string" ? u : u._id,
            )
          : initialData.assignedTo
            ? [
                typeof initialData.assignedTo === "string"
                  ? initialData.assignedTo
                  : initialData.assignedTo._id,
              ]
            : [],
        assignedBy: initialData.assignedBy
          ? typeof initialData.assignedBy === "string"
            ? initialData.assignedBy
            : initialData.assignedBy._id
          : "", // Initialize assignedBy for edit mode
        guides: Array.isArray(initialData.guides)
          ? initialData.guides.map((g) => (typeof g === "string" ? g : g._id))
          : [],
        priority: initialData.priority || "regular",
        inwardEntryDate: initialData.inwardEntryDate
          ? initialData.inwardEntryDate.split("T")[0]
          : "",
        inwardEntryTime: convertedTime,
        dueDate: initialData.dueDate ? initialData.dueDate.split("T")[0] : "",
        targetDate: initialData.targetDate
          ? initialData.targetDate.split("T")[0]
          : "",
        billed:
          typeof initialData.billed === "boolean" ? initialData.billed : true,
        status: initialData.status || "in_progress",
      });
      setClientSearchTerm(initialData.clientName || "");
      const assignedToRaw = Array.isArray(initialData.assignedTo)
        ? initialData.assignedTo
        : initialData.assignedTo
          ? [initialData.assignedTo]
          : [];
      const assignedUserIds = assignedToRaw.map((u) =>
        typeof u === "string" ? u : u._id,
      );
      console.log("[EditModal-FIX] assignedToRaw:", assignedToRaw);
      console.log("[EditModal-FIX] users:", users);
      console.log("[EditModal-FIX] assignedUserIds:", assignedUserIds);
      const selected = usersWithCurrent.filter((u) =>
        assignedUserIds.includes(u._id),
      );
      console.log("[EditModal-FIX] selectedUsers to set:", selected);
      setSelectedUsers(selected);

      // Set guides if available
      const guidesRaw = Array.isArray(initialData.guides)
        ? initialData.guides
        : [];
      const guideIds = guidesRaw.map((g) =>
        typeof g === "string" ? g : g._id,
      );
      const selectedGuidesData = usersWithCurrent.filter((u) =>
        guideIds.includes(u._id),
      );
      setSelectedGuides(selectedGuidesData);

      // Set assignedBy if available
      if (initialData.assignedBy) {
        const assignedById =
          typeof initialData.assignedBy === "string"
            ? initialData.assignedBy
            : initialData.assignedBy._id;
        const assignedByUser = usersWithCurrent.find(
          (u) => u._id === assignedById,
        );
        if (assignedByUser) {
          setSelectedAssignedBy(assignedByUser);
        }
      }

      // Set multi-user assignment toggle based on number of assigned users
      setIsMultiUserAssign(assignedUserIds.length > 1);
    } else if (mode === "create" && isOpen) {
      // Only reset form data if it's not already initialized (when modal first opens)
      setFormData((prev) => {
        // If the form already has data (user has been using it), don't reset the status
        if (prev.title || prev.status !== "yet_to_start") {
          return prev; // Keep existing data
        }
        // Initialize form for first time with current date/time as default
        const now = new Date();
        const currentDate = now.toISOString().split("T")[0];
        const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const converted12Hour = convertTo12Hour(currentTime);

        return {
          title: "",
          description: "",
          clientName: "",
          clientGroup: "",
          workType: [],
          assignedTo: [],
          assignedBy: "", // Will be set by separate useEffect
          guides: [],
          priority: "Today",
          inwardEntryDate: currentDate,
          inwardEntryTime: converted12Hour,
          dueDate: "",
          targetDate: "",
          billed: false,
          status: "yet_to_start", // Use yet_to_start as default
        };
      });
      setClientSearchTerm("");
      setSelectedUsers([]);
      setSelectedGuides([]);
      setIsMultiUserAssign(false); // Reset multi-user toggle for create mode
    }
  }, [mode, initialData, isOpen, users]);

  // Set default assignedBy based on selectedUserId and user role
  useEffect(() => {
    if (mode === "create" && isOpen && loggedInUser) {
      // Only set assignedBy for Admin and Team Head roles
      if (["Admin", "Team Head"].includes(loggedInUser.role)) {
        let defaultAssignedTo;

        // If selectedUserId is provided, use that user as default assignedBy
        if (selectedUserId) {
          const selectedUser = users.find((u) => u._id === selectedUserId);
          if (selectedUser) {
            defaultAssignedTo = selectedUserId;
            setSelectedUsers([selectedUser]);
          } else {
            // Fallback to current user if selected user not found
            defaultAssignedTo = loggedInUser._id;
            setSelectedUsers([loggedInUser]);
          }
        } else {
          // No user selected, default to current user
          defaultAssignedTo = loggedInUser._id;
          setSelectedUsers([loggedInUser]);
        }

        setFormData((prev) => ({
          ...prev,
          assignedTo: defaultAssignedTo,
        }));
      }
        // For non-admin/team-head roles, always use current user
        setFormData((prev) => ({
          ...prev,
          assignedBy: loggedInUser._id,
        }));
        setSelectedAssignedBy(loggedInUser);
      
    }
  }, [mode, isOpen, selectedUserId, users, loggedInUser]);

  // Ensure selectedUsers is set for edit mode when users are loaded
  useEffect(() => {
    if (
      mode === "edit" &&
      initialData &&
      isOpen &&
      users.length > 0 &&
      selectedUsers.length === 0 &&
      (Array.isArray(initialData.assignedTo) || initialData.assignedTo)
    ) {
      const assignedToRaw = Array.isArray(initialData.assignedTo)
        ? initialData.assignedTo
        : initialData.assignedTo
          ? [initialData.assignedTo]
          : [];
      const assignedUserIds = assignedToRaw.map((u) =>
        typeof u === "string" ? u : u._id,
      );
      console.log(
        "[EditModal-FIX][users effect] assignedToRaw:",
        assignedToRaw,
      );
      console.log("[EditModal-FIX][users effect] users:", users);
      console.log(
        "[EditModal-FIX][users effect] assignedUserIds:",
        assignedUserIds,
      );
      const selected = usersWithCurrent.filter((u) =>
        assignedUserIds.includes(u._id),
      );
      console.log(
        "[EditModal-FIX][users effect] selectedUsers to set:",
        selected,
      );
      setSelectedUsers(selected);

      // Set guides if available
      if (
        Array.isArray(initialData.guides) &&
        initialData.guides.length > 0 &&
        selectedGuides.length === 0
      ) {
        const guideIds = initialData.guides.map((g) =>
          typeof g === "string" ? g : g._id,
        );
        const selectedGuidesData = usersWithCurrent.filter((u) =>
          guideIds.includes(u._id),
        );
        setSelectedGuides(selectedGuidesData);
      }

      // Set multi-user assignment toggle based on number of assigned users
      setIsMultiUserAssign(assignedUserIds.length > 1);
    }
    // eslint-disable-next-line
  }, [users, initialData, isOpen, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      toast.error("Please login to create tasks");
      return;
    }

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error("Task Title is required");
      return;
    }

    if (!formData.clientName.trim()) {
      toast.error("Client Name is required");
      return;
    }
    // Validate that clientName matches a real client
    const clientExists = clients.some(
      (c) =>
        c.name.trim().toLowerCase() ===
        formData.clientName.trim().toLowerCase(),
    );
    if (!clientExists) {
      toast.error("Please select a valid client from the list.");
      return;
    }

    if (formData.assignedTo.length === 0) {
      toast.error("Please select at least one user to assign the task to");
      return;
    }

    if (formData.workType.length === 0) {
      toast.error("Please select at least one work type");
      return;
    }

    if (formData.billed !== true && formData.billed !== false) {
      toast.error("Please select whether the task is billed or not");
      return;
    }

    try {
      setUploading(true);

      // Combine date and time into a Date object and send as UTC ISO string
      let combinedInwardEntryDate = null;
      if (formData.inwardEntryDate && formData.inwardEntryTime) {
        const time24 = convertTo24Hour(formData.inwardEntryTime);
        const [h, m] = time24.split(":");
        // Validate date string
        const dateValid = !isNaN(Date.parse(formData.inwardEntryDate));
        const hourValid =
          !isNaN(Number(h)) && Number(h) >= 0 && Number(h) <= 23;
        const minValid = !isNaN(Number(m)) && Number(m) >= 0 && Number(m) <= 59;
        if (dateValid && hourValid && minValid) {
          const dt = new Date(formData.inwardEntryDate);
          dt.setHours(Number(h), Number(m), 0, 0);
          if (!isNaN(dt.getTime())) {
            combinedInwardEntryDate = dt.toISOString();
          } else {
            toast.error("Invalid date/time selected.");
            setUploading(false);
            return;
          }
        } else {
          toast.error("Please provide a valid Inward Entry Date and Time.");
          setUploading(false);
          return;
        }
      } else if (
        mode === "edit" &&
        initialData &&
        initialData.inwardEntryDate
      ) {
        // If editing and user did not change date/time, use the original ISO string
        combinedInwardEntryDate = initialData.inwardEntryDate;
      } else if (formData.inwardEntryDate || formData.inwardEntryTime) {
        // If only one is provided, show error
        toast.error(
          "Please provide both Inward Entry Date and Time, or leave both empty.",
        );
        setUploading(false);
        return;
      }
      // If both are empty, combinedInwardEntryDate remains null
      // Log for debugging
      console.log(
        "Submitting task with inwardEntryDate:",
        combinedInwardEntryDate,
      );

      // Handle assignedTo differently for create vs edit mode
      let assignedToData;
      if (mode === "edit") {
        // For edit mode, send only the first user to update the current task
        assignedToData =
          formData.assignedTo.length > 0 ? formData.assignedTo[0] : null;

        // Validate that we have at least one user assigned
        if (!assignedToData) {
          toast.error("Please select at least one user to assign the task to");
          setUploading(false);
          return;
        }
      } else {
        // For create mode, send the array as usual
        assignedToData = Array.isArray(formData.assignedTo)
          ? formData.assignedTo.filter(Boolean)
          : [formData.assignedTo].filter(Boolean);
      }

      const taskData = {
        ...formData,
        inwardEntryDate: combinedInwardEntryDate,
        assignedTo: assignedToData,
        inwardEntryTime: convertTo24Hour(formData.inwardEntryTime),
        billed: formData.billed,
        // Only include assignedBy if user has permission to set it
        ...(["Admin", "Team Head"].includes(loggedInUser.role) &&
        formData.assignedBy
          ? { assignedBy: formData.assignedBy }
          : {}),
      };

      let response, updatedTask;
      if (mode === "edit" && initialData && initialData._id) {
        response = await fetch(`${API_BASE_URL}/api/tasks/${initialData._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${loggedInUser.token}`,
          },
          body: JSON.stringify(taskData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to update task");
        }
        updatedTask = await response.json();

        // If there are additional users to assign, create new tasks for them
        if (formData.assignedTo.length > 1) {
          const additionalUsers = formData.assignedTo.slice(1); // Skip the first user
          const additionalTaskData = {
            ...formData,
            inwardEntryDate: combinedInwardEntryDate,
            assignedTo: additionalUsers,
            inwardEntryTime: convertTo24Hour(formData.inwardEntryTime),
            billed: formData.billed,
          };

          try {
            const additionalResponse = await fetch(
              `${API_BASE_URL}/api/tasks`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${loggedInUser.token}`,
                },
                body: JSON.stringify(additionalTaskData),
              },
            );

            if (additionalResponse.ok) {
              const additionalTasks = await additionalResponse.json();
              toast.success(
                `Task updated and ${additionalTasks.length} additional task(s) created for other users`,
              );
            } else {
              toast.warning(
                "Task updated but failed to create additional tasks for other users",
              );
            }
          } catch (additionalError) {
            console.error("Error creating additional tasks:", additionalError);
            toast.warning(
              "Task updated but failed to create additional tasks for other users",
            );
          }
        } else {
          toast.success("Task updated successfully");
        }

        if (onSubmit) onSubmit(updatedTask);
        onClose();
      } else {
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${loggedInUser.token}`,
          },
          body: JSON.stringify(taskData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create task");
        }

        const createdTasks = await response.json();
        console.log("Tasks created:", createdTasks); // Debug log

        if (
          createdTasks &&
          Array.isArray(createdTasks) &&
          createdTasks.length > 0
        ) {
          toast.success(`${createdTasks.length} task(s) created successfully`);

          for (const task of createdTasks) {
            if (task && task._id) {
              if (selectedFiles.length > 0) {
                console.log("Starting file upload for task:", task._id); // Debug log
                try {
                  await uploadFiles(task._id);
                  toast.success(`Files uploaded for task: ${task.title}`);
                } catch (uploadError) {
                  console.error("File upload error:", uploadError); // Debug log
                  toast.error(
                    `Task created but file upload failed for ${task.title}: ${uploadError.message}`,
                  );
                }
              }
            } else {
              console.error("Invalid task ID received for one of the tasks");
              toast.error(
                "An error occurred while processing one of the created tasks.",
              );
            }
          }
          // Call onSubmit after all file uploads and before closing the modal
          if (onSubmit) onSubmit(createdTasks);
          // Close the modal after successful task creation and file uploads
          onClose();
        } else {
          console.error("Invalid task ID received:", createdTasks);
          toast.error(
            "An error occurred while creating the task. Invalid ID received.",
          );
        }
      }
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error(error.message);
      setCreatedTaskId(null);
    } finally {
      setUploading(false);
    }
  };

  const handleAccept = async (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      toast.error("Please login to update tasks");
      return;
    }

    if (!initialData || !initialData._id) {
      toast.error("Task ID not found");
      return;
    }

    setUploading(true);
    try {
      // First, update the task with current form data
      let combinedInwardEntryDate;
      if (formData.inwardEntryDate && formData.inwardEntryTime) {
        const [h, m] = formData.inwardEntryTime
          .replace(/(AM|PM)/, "")
          .split(":")
          .map((s) => s.trim());
        const isPM = formData.inwardEntryTime.toUpperCase().includes("PM");
        let hour24 = parseInt(h, 10);
        if (isPM && hour24 !== 12) hour24 += 12;
        else if (!isPM && hour24 === 12) hour24 = 0;

        const dateValid =
          formData.inwardEntryDate &&
          !isNaN(new Date(formData.inwardEntryDate));
        const hourValid = !isNaN(hour24) && hour24 >= 0 && hour24 <= 23;
        const minValid = !isNaN(Number(m)) && Number(m) >= 0 && Number(m) <= 59;
        if (dateValid && hourValid && minValid) {
          const dt = new Date(formData.inwardEntryDate);
          dt.setHours(hour24, Number(m), 0, 0);
          if (!isNaN(dt.getTime())) {
            combinedInwardEntryDate = dt.toISOString();
          } else {
            toast.error("Invalid date/time selected.");
            setUploading(false);
            return;
          }
        } else {
          toast.error("Please provide a valid Inward Entry Date and Time.");
          setUploading(false);
          return;
        }
      } else if (initialData && initialData.inwardEntryDate) {
        combinedInwardEntryDate = initialData.inwardEntryDate;
      } else {
        toast.error("Both Inward Entry Date and Time are required.");
        setUploading(false);
        return;
      }

      // Handle assignedTo - use only the first user for the update (same logic as handleSubmit)
      let assignedToData =
        formData.assignedTo.length > 0 ? formData.assignedTo[0] : null;

      // Validate that we have at least one user assigned
      if (!assignedToData) {
        toast.error("Please select at least one user to assign the task to");
        setUploading(false);
        return;
      }

      const taskData = {
        ...formData,
        inwardEntryDate: combinedInwardEntryDate,
        assignedTo: assignedToData,
        inwardEntryTime: convertTo24Hour(formData.inwardEntryTime),
        billed: formData.billed,
      };

      // Update the task
      const updateResponse = await fetch(
        `${API_BASE_URL}/api/tasks/${initialData._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${loggedInUser.token}`,
          },
          body: JSON.stringify(taskData),
        },
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.message || "Failed to update task");
      }

      const updatedTask = await updateResponse.json();

      // If there are additional users to assign, create new tasks for them
      if (formData.assignedTo.length > 1) {
        const additionalUsers = formData.assignedTo.slice(1); // Skip the first user
        const additionalTaskData = {
          ...formData,
          inwardEntryDate: combinedInwardEntryDate,
          assignedTo: additionalUsers,
          inwardEntryTime: convertTo24Hour(formData.inwardEntryTime),
          billed: formData.billed,
        };

        try {
          const additionalResponse = await fetch(`${API_BASE_URL}/api/tasks`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${loggedInUser.token}`,
            },
            body: JSON.stringify(additionalTaskData),
          });

          if (additionalResponse.ok) {
            const additionalTasks = await additionalResponse.json();
            console.log(
              `Created ${additionalTasks.length} additional task(s) for other users`,
            );
          } else {
            console.warn("Failed to create additional tasks for other users");
          }
        } catch (additionalError) {
          console.error("Error creating additional tasks:", additionalError);
        }
      }

      // Then approve the task
      const approveResponse = await fetch(
        `${API_BASE_URL}/api/tasks/${initialData._id}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${loggedInUser.token}`,
          },
          body: JSON.stringify({ action: "approve" }),
        },
      );

      if (!approveResponse.ok) {
        const errorData = await approveResponse.json();
        throw new Error(errorData.message || "Failed to approve task");
      }

      const successMessage =
        formData.assignedTo.length > 1
          ? `Task updated and approved successfully. ${
              formData.assignedTo.length - 1
            } additional task(s) created for other users.`
          : "Task updated and approved successfully";

      toast.success(successMessage);
      if (onSubmit) onSubmit(updatedTask);
      onClose();
    } catch (error) {
      console.error("Error updating and approving task:", error);
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadFiles = async (taskId) => {
    if (!taskId) {
      throw new Error("Invalid task ID");
    }

    if (!selectedFiles.length) {
      console.log("No files to upload"); // Debug log
      return;
    }

    console.log("Uploading files for task:", taskId, "Files:", selectedFiles); // Debug log
    setUploadProgress({});

    // Upload files in smaller batches to avoid timeout
    const batchSize = 2; // Reduced batch size for better reliability
    const allFailedFiles = [];

    for (let i = 0; i < selectedFiles.length; i += batchSize) {
      const batch = selectedFiles.slice(i, i + batchSize);
      const formData = new FormData();

      batch.forEach((file) => {
        formData.append("files", file);
      });

      try {
        console.log("Uploading batch:", batch); // Debug log

        // Update progress to show uploading
        batch.forEach((_, index) => {
          setUploadProgress((prev) => ({
            ...prev,
            [i + index]: "uploading",
          }));
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

        const response = await fetch(
          `${API_BASE_URL}/api/tasks/${taskId}/files`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${loggedInUser.token}`,
            },
            body: formData,
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to upload files");
        }

        const result = await response.json();
        console.log("Upload response:", result); // Debug log

        // Handle partial success (207 status)
        if (result.failedFiles && result.failedFiles.length > 0) {
          allFailedFiles.push(...result.failedFiles);
          console.warn("Some files failed to upload:", result.failedFiles);
        }

        // Get uploaded files from response
        const uploadedFiles = result.files || result.uploadedFiles || [];

        setTaskFiles((prev) => {
          const updatedFiles = [...prev, ...uploadedFiles];
          console.log("Updated task files:", updatedFiles); // Debug log
          return updatedFiles;
        });

        // Update progress for this batch
        batch.forEach((_, index) => {
          setUploadProgress((prev) => ({
            ...prev,
            [i + index]: "completed",
          }));
        });
      } catch (error) {
        console.error(`Failed to upload batch starting at index ${i}:`, error); // Debug log

        // Handle timeout
        if (error.name === "AbortError") {
          toast.error(
            `Upload timeout for ${batch
              .map((f) => f.name)
              .join(", ")}. Files may be too large or connection is slow.`,
          );
        } else {
          toast.error(
            `Failed to upload ${batch.map((f) => f.name).join(", ")}: ${
              error.message
            }`,
          );
        }

        // Mark batch as failed
        batch.forEach((file, index) => {
          setUploadProgress((prev) => ({
            ...prev,
            [i + index]: "failed",
          }));
          allFailedFiles.push({ filename: file.name, error: error.message });
        });
      }
    }

    // Clear selected files only after all uploads are attempted
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Show summary if there were any failures
    if (allFailedFiles.length > 0) {
      const failedNames = allFailedFiles.map((f) => f.filename).join(", ");
      toast.error(`Failed to upload: ${failedNames}`);
    }
  };

  const handleAssignedToChange = (userId) => {
    const user = usersWithCurrent.find((u) => u._id === userId);
    if (!user) return;

    setFormData((prev) => {
      const newAssignedTo = prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter((id) => id !== userId)
        : [...prev.assignedTo, userId];
      setSelectedUsers(
        usersWithCurrent.filter((u) => newAssignedTo.includes(u._id)),
      );
      setIsDropdownOpen(false); // Close dropdown after each selection
      return { ...prev, assignedTo: newAssignedTo };
    });
  };

  const handleGuideChange = (userId) => {
    const user = usersWithCurrent.find((u) => u._id === userId);
    if (!user) return;

    setFormData((prev) => {
      const newGuides = prev.guides.includes(userId)
        ? prev.guides.filter((id) => id !== userId)
        : [...prev.guides, userId];
      setSelectedGuides(
        usersWithCurrent.filter((u) => newGuides.includes(u._id)),
      );
      return { ...prev, guides: newGuides };
    });
  };

  const handleAssignedByChange = (userId) => {
    const user = usersWithCurrent.find((u) => u._id === userId);
    if (!user) return;

    setFormData((prev) => ({
      ...prev,
      assignedBy: userId,
    }));
    setSelectedAssignedBy(user);
    setIsAssignedByDropdownOpen(false); // Close dropdown after selection
  };

  const handleWorkTypeChange = (type) => {
    setFormData((prev) => {
      const newWorkType = prev.workType.includes(type)
        ? prev.workType.filter((t) => t !== type)
        : [...prev.workType, type];

      return { ...prev, workType: newWorkType };
    });
  };

  const handleClientNameChange = (clientId) => {
    const selectedClient = clients.find((client) => client._id === clientId);

    if (selectedClient) {
      setFormData((prev) => ({
        ...prev,
        clientName: selectedClient.name,
        clientGroup: selectedClient.group.name,
        workType: selectedClient.workOffered.map((wt) => wt.name),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        clientName: "",
        clientGroup: "",
        workType: [],
      }));
    }
    setIsClientDropdownOpen(false);
  };

  const selectedUserDisplay =
    selectedUsers.length > 0
      ? `${selectedUsers.length} user${
          selectedUsers.length > 1 ? "s" : ""
        } selected`
      : "Select users";

  // Ensure current user is always in the users list for assignment
  const usersWithCurrent = useMemo(() => {
    if (!loggedInUser) return users;
    if (users.some((u) => u._id === loggedInUser._id)) return users;
    return [loggedInUser, ...users];
  }, [users, loggedInUser]);

  // Filter users based on role-based permissions
  const filteredUsers = usersWithCurrent.filter((user) => {
    // First filter by search term
    const matchesSearch = `${user.firstName} ${user.lastName}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Filter guides based on search term
  const filteredGuides = usersWithCurrent.filter((user) => {
    const matchesSearch = `${user.firstName} ${user.lastName}`
      .toLowerCase()
      .includes(guideSearchTerm.toLowerCase());
    return matchesSearch;
  });

  // Filter users for assignedBy dropdown based on role and search term
  const getFilteredAssignedByUsers = () => {
    // Only allow admin and team head to see/modify assignedBy dropdown
    if (!["Admin", "Team Head"].includes(loggedInUser?.role)) {
      return [];
    }

    // Filter based on user's access level
    let allowedUsers = [];
    if (loggedInUser.role === "Admin") {
      // Admin can see all users
      allowedUsers = usersWithCurrent;
    } else if (loggedInUser.role === "Team Head") {
      // Team Head can see users based on their userAccessLevel setting
      if (loggedInUser.userAccessLevel === "All Users") {
        allowedUsers = usersWithCurrent;
      } else {
        // Team Only - show users in the same team
        allowedUsers = usersWithCurrent.filter(
          (user) =>
            user.team &&
            loggedInUser.team &&
            user.team.toString() === loggedInUser.team.toString(),
        );
      }
    }

    // Filter by search term
    return allowedUsers.filter((user) => {
      const matchesSearch = `${user.firstName} ${user.lastName}`
        .toLowerCase()
        .includes(assignedBySearchTerm.toLowerCase());
      return matchesSearch;
    });
  };

  const filteredAssignedByUsers = getFilteredAssignedByUsers();

  const handleWorkTypeSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/work-types`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify(workTypeFormData),
      });

      if (!response.ok) {
        throw new Error("Failed to create work type");
      }

      const newWorkType = await response.json();
      setWorkTypes((prev) => [...prev, newWorkType]);
      setIsWorkTypeModalOpen(false);
      setWorkTypeFormData({ name: "" });
      toast.success("Work type created successfully");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleFileDeleted = (fileId) => {
    setTaskFiles((prev) => prev.filter((f) => f._id !== fileId));
  };

  const handleOpenModal = () => {
    const { date, time } = getCurrentDateTime();
    setFormData({
      title: "",
      description: "",
      clientName: "",
      clientGroup: "",
      workType: [],
      assignedTo: [],
      priority: "today",
      inwardEntryDate: date,
      inwardEntryTime: time,
      dueDate: "",
      targetDate: "",
      billed: false,
      status: "yet_to_start", // Use yet_to_start as default
    });
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setFormData({
      title: "",
      description: "",
      clientName: "",
      clientGroup: "",
      workType: [],
      assignedTo: [],
      guides: [],
      priority: "today",
      inwardEntryDate: "",
      inwardEntryTime: "",
      dueDate: "",
      targetDate: "",
      billed: false,
      status: "yet_to_start", // Use yet_to_start as default
    });
    setSelectedFiles([]);
    setTaskFiles([]);
    setCreatedTaskId(null);
    setUploading(false);
    setSelectedGuides([]);
  };

  const filteredWorkTypes = useMemo(() => {
    if (!workTypeSearchTerm) return workTypes;
    return workTypes.filter((type) =>
      type.name.toLowerCase().includes(workTypeSearchTerm.toLowerCase()),
    );
  }, [workTypes, workTypeSearchTerm]);

  useEffect(() => {
    const handleClickOutsideDropdown = (event) => {
      if (!event.target.closest(".work-type-dropdown")) {
        setTimeout(() => setIsWorkTypeDropdownOpen(false), 100);
      }
    };
    if (isWorkTypeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutsideDropdown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideDropdown);
    };
  }, [isWorkTypeDropdownOpen]);

  // Render modal only if isOpen
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {mode === "edit" ? "Edit Task" : "Create New Task"}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name & Work In Brief{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={clientSearchTerm}
                      onChange={(e) => {
                        const value = e.target.value;
                        setClientSearchTerm(value);
                        setFormData((prev) => ({
                          ...prev,
                          clientName: value,
                          clientGroup: value === "" ? "" : prev.clientGroup,
                        }));
                        setIsClientDropdownOpen(true);
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      placeholder="Search client or group..."
                      className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {isClientDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client) => (
                            <div
                              key={client._id}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                // Check if client group is one of the internal work groups
                                const internalWorkGroups = [
                                  "Hari Agarwal and Associates",
                                  "Dreamlabs",
                                  "SFS",
                                ];
                                const clientGroupName = client?.group
                                  ? client?.group?.name
                                  : "";
                                const isInternalWorkGroup =
                                  internalWorkGroups.includes(clientGroupName);

                                setFormData((prev) => ({
                                  ...prev,
                                  clientName: client.name,
                                  clientGroup: clientGroupName,
                                  billed: isInternalWorkGroup ? true : false, // Set to true for internal work groups
                                }));
                                setClientSearchTerm(client.name);
                                setIsClientDropdownOpen(false);
                              }}
                            >
                              <div className="font-medium text-gray-900">
                                {client.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {client.group ? client.group.name : "No Group"}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500">
                            No clients found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Group <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.clientGroup}
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Priority</option>
                    {priorities.map((priority) => (
                      <option
                        key={priority._id || priority.name}
                        value={priority.name}
                      >
                        {priority.name.charAt(0).toUpperCase() +
                          priority.name.slice(1).replace(/([A-Z])/g, " $1")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inward Entry Date
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={formData.inwardEntryDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          inwardEntryDate: e.target.value,
                        })
                      }
                      className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="flex items-center space-x-2">
                      <select
                        value={
                          formData.inwardEntryTime
                            .split(" ")[0]
                            ?.split(":")[0]
                            ?.padStart(2, "0") || "00"
                        }
                        onChange={(e) => {
                          const timeParts = formData.inwardEntryTime.split(" ");
                          let [hour, minutes] = (timeParts[0] || "00:00").split(
                            ":",
                          );
                          const ampm = timeParts[1] || "AM";
                          const newHour = e.target.value.padStart(2, "0");
                          const newTime = `${newHour}:${(
                            minutes || "00"
                          ).padStart(2, "0")} ${ampm}`;
                          setFormData({
                            ...formData,
                            inwardEntryTime: newTime,
                          });
                        }}
                        className="w-1/3 border rounded-md px-2 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="00">00</option>
                        {Array.from({ length: 12 }, (_, i) =>
                          (i + 1).toString().padStart(2, "0"),
                        ).map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>
                      <span className="text-gray-500">:</span>
                      <select
                        value={
                          formData.inwardEntryTime
                            .split(" ")[0]
                            ?.split(":")[1]
                            ?.padStart(2, "0") || "00"
                        }
                        onChange={(e) => {
                          const timeParts = formData.inwardEntryTime.split(" ");
                          let [hours, minute] = (timeParts[0] || "00:00").split(
                            ":",
                          );
                          const ampm = timeParts[1] || "AM";
                          const newMinute = e.target.value.padStart(2, "0");
                          const newTime = `${(hours || "00").padStart(
                            2,
                            "0",
                          )}:${newMinute} ${ampm}`;
                          setFormData({
                            ...formData,
                            inwardEntryTime: newTime,
                          });
                        }}
                        className="w-1/3 border rounded-md px-2 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {Array.from({ length: 60 }, (_, i) =>
                          i.toString().padStart(2, "0"),
                        ).map((minute) => (
                          <option key={minute} value={minute}>
                            {minute}
                          </option>
                        ))}
                      </select>
                      <select
                        value={formData.inwardEntryTime.split(" ")[1] || "AM"}
                        onChange={(e) => {
                          const timeParts = formData.inwardEntryTime.split(" ");
                          const time = timeParts[0] || "00:00";
                          const newTime = `${time} ${e.target.value}`;
                          setFormData({
                            ...formData,
                            inwardEntryTime: newTime,
                          });
                        }}
                        className="w-1/3 border rounded-md px-1 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) =>
                      setFormData({ ...formData, targetDate: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Works <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={
                      formData.billed === true
                        ? "yes"
                        : formData.billed === false
                          ? "no"
                          : ""
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        billed:
                          e.target.value === "yes"
                            ? true
                            : e.target.value === "no"
                              ? false
                              : "",
                      })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {/* Only show AssignedBy and Guides row for Admin and Team Head */}
                <div className="md:col-span-2 flex flex-row md:items-end gap-4">
                  {/* Assigned By */}
                  <div className="flex-1 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned By
                    </label>
                    <div className="relative w-full">
                      {isAssignedByDropdownOpen && (
                        <div className="absolute z-10 w-full bottom-full mb-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                          <div className="sticky top-0 bg-white p-2 border-b">
                            <input
                              type="text"
                              placeholder="Search users..."
                              value={assignedBySearchTerm}
                              onChange={(e) =>
                                setAssignedBySearchTerm(e.target.value)
                              }
                              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              ref={assignedBySearchInputRef}
                            />
                          </div>
                          <div className="py-1">
                            {filteredAssignedByUsers.length > 0 ? (
                              filteredAssignedByUsers.map((user) => (
                                <button
                                  key={user._id}
                                  type="button"
                                  onClick={() =>
                                    handleAssignedByChange(user._id)
                                  }
                                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 ${
                                    formData.assignedBy === user._id
                                      ? "bg-blue-50"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-3 overflow-hidden">
                                      <img
                                        src={user.photo?.url || defaultProfile}
                                        alt={`${user.firstName} ${user.lastName}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {user.firstName} {user.lastName}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {user.group}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-gray-500 text-center">
                                No users found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={
                          ["Admin"].includes(loggedInUser.role)
                            ? false
                            : true
                        }
                        onClick={() =>
                          setIsAssignedByDropdownOpen(!isAssignedByDropdownOpen)
                        }
                        className="w-full flex items-center justify-between border rounded-md px-3 py-2 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span className="text-gray-700">
                          {selectedAssignedBy
                            ? `${selectedAssignedBy.firstName} ${selectedAssignedBy.lastName}`
                            : "Select user"}
                        </span>
                        {["Admin"].includes(loggedInUser.role) ? (
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              isAssignedByDropdownOpen
                                ? "transform rotate-180"
                                : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        ) : null}
                      </button>
                    </div>
                  </div>

                  {/* Guides */}
                  <div className="flex-1 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guides
                    </label>
                    <div className="relative w-full">
                      {isGuideDropdownOpen && (
                        <div className="absolute z-10 w-full bottom-full mb-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                          <div className="sticky top-0 bg-white p-2 border-b">
                            <input
                              type="text"
                              placeholder="Search guides..."
                              value={guideSearchTerm}
                              onChange={(e) =>
                                setGuideSearchTerm(e.target.value)
                              }
                              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              ref={guideSearchInputRef}
                            />
                          </div>
                          <div className="py-1">
                            {filteredGuides.length > 0 ? (
                              filteredGuides.map((user) => (
                                <button
                                  key={user._id}
                                  type="button"
                                  onClick={() => handleGuideChange(user._id)}
                                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 ${
                                    formData.guides.includes(user._id)
                                      ? "bg-blue-50"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-medium mr-3 overflow-hidden">
                                      <img
                                        src={user.photo?.url || defaultProfile}
                                        alt={`${user.firstName} ${user.lastName}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {user.firstName} {user.lastName}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {user.group}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-gray-500 text-center">
                                No guides found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setIsGuideDropdownOpen(!isGuideDropdownOpen)
                        }
                        className="w-full flex items-center justify-between border rounded-md px-3 py-2 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span className="text-gray-700">
                          {selectedGuides.length > 0
                            ? `${selectedGuides.length} guide${selectedGuides.length > 1 ? "s" : ""} selected`
                            : "Select guides"}
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            isGuideDropdownOpen ? "transform rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {/* Selected guides chips */}
                      {selectedGuides.length > 0 && (
                        <div className="absolute left-0 w-full mt-2 flex flex-wrap gap-2 z-10">
                          {selectedGuides.map((guide) => (
                            <span
                              key={guide._id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                              {guide.firstName} {guide.lastName}
                              <button
                                type="button"
                                onClick={() => handleGuideChange(guide._id)}
                                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-green-200"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assign To and Team Head in a single row, chips absolutely positioned below Assign To */}
                <div className="md:col-span-2 flex flex-row md:items-end gap-4">
                  {/* Assign To */}
                  <div className="flex-1 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign To <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-full">
                        {isDropdownOpen && (
                          <div className="absolute z-10 w-full bottom-full mb-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                            <div className="sticky top-0 bg-white p-2 border-b">
                              <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                                ref={assignSearchInputRef}
                              />
                            </div>
                            <div className="py-1">
                              {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                  <button
                                    key={user._id}
                                    type="button"
                                    onClick={() => {
                                      if (isMultiUserAssign) {
                                        handleAssignedToChange(user._id);
                                      } else {
                                        setFormData((prev) => ({
                                          ...prev,
                                          assignedTo: [user._id],
                                        }));
                                        setSelectedUsers([user]);
                                        setIsDropdownOpen(false);
                                      }
                                    }}
                                    className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 ${
                                      formData.assignedTo.includes(user._id)
                                        ? "bg-blue-50"
                                        : ""
                                    }`}
                                  >
                                    <div className="flex items-center">
                                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-3 overflow-hidden">
                                        <img
                                          src={
                                            user.photo?.url || defaultProfile
                                          }
                                          alt={`${user.firstName} ${user.lastName}`}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900">
                                          {user.firstName} {user.lastName}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {user.group}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-2 text-gray-500 text-center">
                                  No users found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full flex items-center justify-between border rounded-md px-3 py-2 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <span className="text-gray-700">
                            {selectedUserDisplay}
                          </span>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              isDropdownOpen ? "transform rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-pressed={isMultiUserAssign}
                        onClick={() => {
                          setIsMultiUserAssign((v) => {
                            const next = !v;
                            if (!next && formData.assignedTo.length > 1) {
                              setFormData((prev) => ({
                                ...prev,
                                assignedTo: prev.assignedTo.slice(0, 1),
                              }));
                              setSelectedUsers(
                                usersWithCurrent.filter(
                                  (u) => u._id === formData.assignedTo[0],
                                ),
                              );
                            }
                            return next;
                          });
                        }}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 ${
                          isMultiUserAssign ? "bg-blue-500" : "bg-gray-200"
                        }`}
                        tabIndex={0}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            isMultiUserAssign
                              ? "translate-x-5"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="ml-2 text-xs text-gray-500">
                        Multiple
                      </span>
                    </div>

                    {/* Absolutely position chips below dropdown, not affecting Team Head */}
                    {selectedUsers.length > 0 && (
                      <div className="absolute left-0 w-full mt-2 flex flex-wrap gap-2 z-10">
                        {selectedUsers.map((user) => (
                          <span
                            key={user._id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {user.firstName} {user.lastName}
                            <button
                              type="button"
                              onClick={() => {
                                if (isMultiUserAssign) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    assignedTo: prev.assignedTo.filter(
                                      (id) => id !== user._id,
                                    ),
                                  }));
                                  setSelectedUsers((prev) =>
                                    prev.filter((u) => u._id !== user._id),
                                  );
                                } else {
                                  setFormData((prev) => ({
                                    ...prev,
                                    assignedTo: [],
                                  }));
                                  setSelectedUsers([]);
                                }
                              }}
                              className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Team Head */}
                  <div className="flex-1 flex flex-col justify-end">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team Head
                    </label>
                    <input
                      type="text"
                      value={(() => {
                        // Collect all unique team heads and admins for the teams of selected users
                        const headsMap = {};
                        selectedUsers.forEach((u) => {
                          if (!u.team) return;
                          // Find all users in the same team with role 'Team Head' or 'Admin'
                          users.forEach((x) => {
                            if (
                              x.team &&
                              x.team.toString() === u.team.toString() &&
                              (x.role === "Team Head" || x.role === "Admin")
                            ) {
                              headsMap[x._id] = x;
                            }
                          });
                        });
                        // If no team heads or admins found, return empty string
                        const heads = Object.values(headsMap);
                        if (heads.length === 0) return "";
                        return heads
                          .map((h) => `${h.firstName} ${h.lastName}`)
                          .join(", ");
                      })()}
                      className="w-full border rounded-md px-3 py-2 bg-gray-50 text-gray-700"
                      readOnly
                      placeholder="Team Head will appear here"
                    />
                  </div>
                </div>

                {/* Task Status Dropdown */}
                <div className="md:col-span-2 mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Task Status <span className="text-red-500">*</span>
                  </label>
                  <TaskStatusDropdown
                    value={formData.status}
                    onChange={(status) => setFormData({ ...formData, status })}
                    excludeCompleted={false}
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Description/Notes */}
                <div className="md:col-span-2 mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description/Notes
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Enter task description or notes..."
                  />
                </div>
                <div className="md:col-span-2 mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Type <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center gap-2">
                    <div
                      className="w-full border rounded-md px-3 py-2 bg-white flex flex-wrap gap-2 min-h-[42px] cursor-pointer work-type-dropdown"
                      onClick={() => setIsWorkTypeDropdownOpen(true)}
                    >
                      {formData.workType.length === 0 && (
                        <span className="text-gray-400">
                          Select or search work type...
                        </span>
                      )}
                      {formData.workType.map((type) => (
                        <span
                          key={type}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-400"
                        >
                          {type}
                          {formData.workType.includes(type) && (
                            <span className="float-right text-blue-600">✔</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleWorkTypeChange(type);
                            }}
                            className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setWorkTypeFormData({ name: "" });
                        setIsWorkTypeModalOpen(true);
                        setIsWorkTypeDropdownOpen(false);
                      }}
                      className="ml-2 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 border-2 border-gray-200 hover:bg-gray-200 whitespace-nowrap"
                    >
                      + New Work Type
                    </button>
                    <button
                      type="button"
                      aria-pressed={isMultiWorkTypeAssign}
                      onClick={() => {
                        setIsMultiWorkTypeAssign((v) => {
                          const next = !v;
                          if (!next && formData.workType.length > 1) {
                            setFormData((prev) => ({
                              ...prev,
                              workType: prev.workType.slice(0, 1),
                            }));
                          }
                          return next;
                        });
                      }}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 ${
                        isMultiWorkTypeAssign ? "bg-blue-500" : "bg-gray-200"
                      }`}
                      tabIndex={0}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          isMultiWorkTypeAssign
                            ? "translate-x-5"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="ml-2 text-xs text-gray-500">Multiple</span>
                    {isWorkTypeDropdownOpen && (
                      <div className="absolute z-20 w-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto work-type-dropdown">
                        <div className="sticky top-0 bg-white p-2 border-b">
                          <input
                            type="text"
                            placeholder="Search work type..."
                            value={workTypeSearchTerm}
                            onChange={(e) =>
                              setWorkTypeSearchTerm(e.target.value)
                            }
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        </div>
                        <div className="py-1">
                          {filteredWorkTypes.length > 0 ? (
                            filteredWorkTypes.map((type) => (
                              <button
                                key={type._id}
                                type="button"
                                className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 cursor-pointer ${
                                  formData.workType.includes(type.name)
                                    ? "bg-blue-50"
                                    : ""
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (isMultiWorkTypeAssign) {
                                    handleWorkTypeChange(type.name);
                                  } else {
                                    setFormData((prev) => ({
                                      ...prev,
                                      workType: [type.name],
                                    }));
                                    setIsWorkTypeDropdownOpen(false);
                                  }
                                }}
                              >
                                {type.name}
                                {formData.workType.includes(type.name) && (
                                  <span className="float-right text-blue-600">
                                    ✔
                                  </span>
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-gray-500">
                              No work types found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Enhanced File selection section */}
              {(mode !== "edit" || (mode === "edit" && !hideFileSection)) && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">
                      Attach Files (Optional)
                    </h3>
                    <div className="text-sm text-gray-500">
                      Max {MAX_FILES} files, {MAX_FILE_SIZE / 1024 / 1024}MB per
                      file, {MAX_TOTAL_SIZE / 1024 / 1024}MB total
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <label className="flex-1">
                        <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition-colors">
                          <input
                            type="file"
                            multiple
                            onChange={handleFileSelect}
                            ref={fileInputRef}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
                          />
                          <div className="text-center">
                            <svg
                              className="mx-auto h-12 w-12 text-gray-400"
                              stroke="currentColor"
                              fill="none"
                              viewBox="0 0 48 48"
                            >
                              <path
                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <p className="mt-1 text-sm text-gray-600">
                              Click to select files or drag and drop
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              PDF, Word, Excel, PowerPoint, Images, Text files
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>

                    {selectedFiles.length > 0 && (
                      <div className="mt-4 border rounded-lg divide-y">
                        <div className="p-3 bg-gray-50 text-sm font-medium text-gray-700">
                          Selected Files ({selectedFiles.length})
                        </div>
                        <ul className="divide-y">
                          {selectedFiles.map((file, index) => (
                            <li
                              key={index}
                              className="p-3 flex items-center justify-between hover:bg-gray-50"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="text-gray-500">
                                  {file.type.startsWith("image/")
                                    ? "🖼️"
                                    : file.type.includes("pdf")
                                      ? "📄"
                                      : file.type.includes("word")
                                        ? "📝"
                                        : file.type.includes("excel") ||
                                            file.type.includes("spreadsheet")
                                          ? "📊"
                                          : file.type.includes("powerpoint") ||
                                              file.type.includes("presentation")
                                            ? "📑"
                                            : "📎"}
                                </span>
                                <div>
                                  <p className="text-sm font-medium text-gray-700">
                                    {file.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSelectedFile(index)}
                                className="text-red-500 hover:text-red-700 p-1"
                                disabled={uploading}
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {uploading && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-600 mb-2">
                          Uploading files...
                        </div>
                        <div className="space-y-2">
                          {selectedFiles.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-2"
                            >
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    uploadProgress[index] === "completed"
                                      ? "bg-green-500"
                                      : uploadProgress[index] === "failed"
                                        ? "bg-red-500"
                                        : uploadProgress[index] === "uploading"
                                          ? "bg-blue-500 animate-pulse"
                                          : "bg-gray-300"
                                  }`}
                                  style={{
                                    width:
                                      uploadProgress[index] === "completed"
                                        ? "100%"
                                        : uploadProgress[index] === "uploading"
                                          ? "50%"
                                          : uploadProgress[index] === "failed"
                                            ? "100%"
                                            : "0%",
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 min-w-[80px]">
                                {uploadProgress[index] === "completed"
                                  ? "✓ Done"
                                  : uploadProgress[index] === "failed"
                                    ? "✗ Failed"
                                    : uploadProgress[index] === "uploading"
                                      ? "Uploading..."
                                      : "Waiting..."}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Read-only Task Info Section - Only show in edit mode */}
              {mode === "edit" && initialData && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-medium text-gray-700 mb-4">
                    Task Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Assigned By */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assigned By
                      </label>
                      <input
                        type="text"
                        value={
                          initialData.assignedBy
                            ? `${initialData.assignedBy.firstName || ""} ${
                                initialData.assignedBy.lastName || ""
                              }`.trim()
                            : "N/A"
                        }
                        className="w-full border rounded-md px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed"
                        readOnly
                        disabled
                      />
                    </div>

                    {/* Task Creation Date & Time */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Task Created On
                      </label>
                      <input
                        type="text"
                        value={
                          initialData.createdAt
                            ? new Date(initialData.createdAt).toLocaleString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                },
                              )
                            : "N/A"
                        }
                        className="w-full border rounded-md px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed"
                        readOnly
                        disabled
                      />
                    </div>

                    {/* Approved By */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Approved By
                      </label>
                      <input
                        type="text"
                        value={(() => {
                          if (initialData.approvedBy) {
                            const firstName =
                              initialData.approvedBy.firstName || "";
                            const lastName =
                              initialData.approvedBy.lastName || "";
                            const fullName = `${firstName} ${lastName}`.trim();

                            if (fullName) {
                              return fullName;
                            }

                            // Fallback to email if name is not available
                            if (initialData.approvedBy.email) {
                              return initialData.approvedBy.email;
                            }

                            return "Verifier";
                          }

                          return initialData.verificationStatus === "completed"
                            ? "Approved (User Unknown)"
                            : "Not Yet Approved";
                        })()}
                        className="w-full border rounded-md px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed"
                        readOnly
                        disabled
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ITR Progress Table - only show for tasks with ITR work type in edit mode */}
              {mode === "edit" &&
                initialData &&
                (() => {
                  // Only show for tasks with work type 'Prep of Income Tax Returns ITR - Non Tax Audit'
                  const hasRequiredWorkType =
                    Array.isArray(initialData.workType) &&
                    initialData.workType.some((wt) => {
                      const workTypeName =
                        typeof wt === "string" ? wt : wt.name || "";
                      return (
                        workTypeName.trim().toLowerCase() ===
                        "prep of income tax returns itr - non tax audit".toLowerCase()
                      );
                    });
                  return hasRequiredWorkType ? (
                    <ITRProgressTable
                      taskId={initialData._id}
                      initialData={initialData}
                      onUpdate={(updatedTask) => {
                        // Optionally handle the updated task data
                        console.log("ITR progress updated:", updatedTask);
                      }}
                    />
                  ) : null;
                })()}

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={uploading}
                >
                  Cancel
                </button>
                {mode === "edit" && showAcceptButton && (
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={uploading}
                    className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700
                      ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {uploading ? "Accepting..." : "Accept"}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={uploading}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
                    ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {uploading
                    ? mode === "edit"
                      ? "Updating..."
                      : "Creating Task..."
                    : mode === "edit"
                      ? "Update Task"
                      : "Create Task"}
                </button>
              </div>
            </form>

            {createdTaskId && taskFiles.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Uploaded Files</h3>
                  <FileList
                    taskId={createdTaskId}
                    files={taskFiles}
                    onFileDeleted={(fileId) => {
                      setTaskFiles((prev) =>
                        prev.filter((f) => f._id !== fileId),
                      );
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Work Type Modal */}
      {isWorkTypeModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 work-type-modal">
          <div
            className="bg-white rounded-lg p-8 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6">Add New Work Type</h2>
            <form onSubmit={handleWorkTypeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Type Name
                </label>
                <input
                  type="text"
                  value={workTypeFormData.name}
                  onChange={(e) =>
                    setWorkTypeFormData({
                      ...workTypeFormData,
                      name: e.target.value,
                    })
                  }
                  className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsWorkTypeModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Add Work Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateTask;
