import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { initializeApp,getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, onSnapshot, orderBy, serverTimestamp, limit, addDoc, doc, setDoc, getDoc } from 'firebase/firestore';
//import firebaseConfig from './firebaseConfig';
import { Zap, Utensils, Send, Loader2, BarChart, XCircle, CheckCircle, AlertTriangle, MessageSquare, Camera, Image, Gauge, Scale, Upload, User, Moon, Sun, Mic, Sparkles, Carrot, Milk, Soup, Egg, Fish, Salad, Coffee, Apple, Leaf, Beef, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import './index.css';
// --- FIREBASE & API CONFIGURATION ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {

  authDomain: "nutriscan-7cd75.firebaseapp.com",
  projectId: "nutriscan-7cd75",
  storageBucket: "nutriscan-7cd75.firebasestorage.app",
  messagingSenderId: "363283289599",
  appId: "1:363283289599:web:7c9fdbdb106875e9a803ca",
  measurementId: "G-V0SQTTSV5N"
};
const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

//const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
//const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 
//const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
//const firebaseConfig = _firebase_config;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


const appId = "nutriscan-app";
const initialAuthToken = null;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";
const API_KEY = "AIzaSyDStWJEyF7o7AdCeOhR6l_naChN3TFnOyo"; 

// Utility function to generate a random user ID if auth is not ready
const generateRandomId = () => `anon-${Math.random().toString(36).substring(2, 9)}`;

// --- BMR CALCULATION UTILITIES ---
const ACTIVITY_FACTORS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55, // DEFAULT FACTOR USED NOW
    very_active: 1.725,
    extra_active: 1.9
};

const calculateBMR = (gender, weightKg, heightCm, age) => {
    // Mifflin-St Jeor Equation
    if (gender === 'male') {
        return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else if (gender === 'female') {
        return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
    return 0;
};

// FIX: Now defaults to MODERATE activity factor (1.55) since Step 3 is removed.
const calculateDailyCalories = (bmr) => {
    const defaultFactor = ACTIVITY_FACTORS['moderate'];
    return Math.round(bmr * defaultFactor);
};

// --- APP COMPONENT ---

const App = () => {
    // UI State
    const [activeView, setActiveView] = useState('analyzer');
    const [scanMode, setScanMode] = useState('upload'); 
    const [labelImage, setLabelImage] = useState(null); 
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null); 
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [theme, setTheme] = useState('light');
    const [funFact, setFunFact] = useState('');
    const [portionSize, setPortionSize] = useState('1 serving');
    const [isVoiceListening, setIsVoiceListening] = useState(false); // State for voice input feedback

    // Refs for Camera functionality
    const videoRef = useRef(null);
    const streamRef = useRef(null); 
    const speechRecognitionRef = useRef(null);

    // Chatbot State
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false); 
    
    // Firebase & User Profile State
    //const [db, setDb] = useState(null);
    //const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false); 
    const [dietLog, setDietLog] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showLoginScreen, setShowLoginState] = useState(true); 

    const [profile, setProfile] = useState({
        gender: '', 
        age: 0,
        weight: 0, 
        height: 0, 
        // Retained for calculation uniformity, but hardcoded to moderate
        activityLevel: 'moderate', 
        dailyCalories: 0,
        bmi: 0,
        isSetup: false,
    });
    
    // Meal Plan State
    const [mealPlan, setMealPlan] = useState(null);
    const [isGeneratingMealPlan, setIsGeneratingMealPlan] = useState(false);

    // --- BMR & BMI CALCULATIONS ---

    useEffect(() => {
        if (profile.weight > 0 && profile.height > 0 && profile.age > 0) {
            const bmr = calculateBMR(profile.gender, profile.weight, profile.height, profile.age);
            // FIX: Use new calculateDailyCalories without activity level argument
            const dailyCals = calculateDailyCalories(bmr);
            const heightM = profile.height / 100;
            const bmi = Math.round((profile.weight / (heightM * heightM)) * 10) / 10;
            
            setProfile(p => ({
                ...p,
                dailyCalories: dailyCals,
                bmi: bmi
            }));
        }
    }, [profile.gender, profile.weight, profile.height, profile.age, profile.activityLevel]);

    // --- FUN FACTS & MOTIVATION ---
    const nutritionFacts = [
        "A single apple contains about 4 grams of fiber, which aids digestion!",
        "Eating slowly can help you feel full sooner, preventing overeating.",
        "Your body needs Vitamin D to absorb calcium, which strengthens bones.",
        "Water makes up about 60% of an adult human's body weight.",
        "Spinach is a great source of iron, but pairing it with Vitamin C (like lemon) helps absorption.",
    ];
    
    const showRandomFunFact = () => {
        const fact = nutritionFacts[Math.floor(Math.random() * nutritionFacts.length)];
        setFunFact(fact);
        setTimeout(() => setFunFact(''), 15000); // Increased duration to 15 seconds
    };
    
    const showMotivationalPopup = (caloriesSaved) => {
         setMessage(`🎉 Success! You saved ${caloriesSaved} kcal today! Keep it up! 🔥`);
         setTimeout(() => setMessage(null), 5000);
    }

    // --- FIREBASE INITIALIZATION & AUTH ---
    const getUserDocRef = useCallback((firestore) => {
        // FIX: Ensuring userId is checked before creating doc path
        if (!userId) return null;
        return doc(firestore, 'artifacts', appId, 'users', userId);
    }, [userId]);
    
    // Login Screen Action
    const handleLogin = () => {
        setShowLoginState(false);
        if (isAuthenticated && profile.isSetup) {
             // Already authenticated and profile is set up, proceed
        } else {
             // First time login, needs profile setup
             setShowProfileModal(true);
        }
    };

    useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            setUserId(user.uid);
            setIsAuthenticated(true);
        } else {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                const anonUser = await signInAnonymously(auth);
                setUserId(anonUser.user.uid);
                setIsAuthenticated(true);
            }
        }
        setIsAuthReady(true);
    });

    return () => unsubscribe();
}, []);

    /*useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestore);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {*/
    useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            setUserId(user.uid);
            setIsAuthenticated(true);
        } else {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                const anonUser = await signInAnonymously(auth);
                setUserId(anonUser.user.uid);
                setIsAuthenticated(true);
            }
        }
        setIsAuthReady(true);
    });

    return () => unsubscribe();
}, []);

       /* } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setUserId(generateRandomId());
            setIsAuthReady(true);
            setIsAuthenticated(true);
        }
    }, []);*/
    
    // Load User Profile on Auth Ready
    useEffect(() => {
        const loadProfile = async () => {
            if (!db || !userId) return;

            const docRef = getUserDocRef(db);
            if (!docRef) return; // FIX: check if docRef is null

            try {
                const docSnap = await getDoc(docRef, { source: 'server' }); 
                if (docSnap.exists() && docSnap.data().isSetup) {
                    const data = docSnap.data();
                    setProfile(p => ({ 
                        ...p, 
                        ...data,
                        isSetup: true 
                    }));
                    setShowProfileModal(false); 
                    setShowLoginState(false); 
                    // FIX 1: Clear persistent message after successful setup load
                    setMessage(null); 
                } else {
                    setProfile(p => ({ ...p, isSetup: false }));
                    setShowLoginState(true);
                }
            } catch (e) {
                console.error("Error loading profile:", e);
                 setError(`Database connection failed: ${e.message}. Check network and Firebase setup`);
            }
        };

        if (isAuthReady && userId) {
            loadProfile();
        }
    }, [isAuthReady, userId, db, getUserDocRef]);


    // Save Profile Setup
    const saveProfile = async (newProfile) => {
        if (!db || !userId) return false;

        // Simple validation check
        if (newProfile.age <= 0 || newProfile.weight <= 0 || newProfile.height <= 0 || !newProfile.gender) {
            setError("Please complete all profile fields with valid positive values.");
            return false;
        }

        setError(null);
        const docRef = getUserDocRef(db);
        if (!docRef) return false; // FIX: check if docRef is null
        
        try {
            // Recalculate BMR/Calories with new data (using default activity factor)
            const bmr = calculateBMR(newProfile.gender, newProfile.weight, newProfile.height, newProfile.age);
            const dailyCals = calculateDailyCalories(bmr); // FIX: no activity level argument
            const heightM = newProfile.height / 100;
            const bmi = Math.round((newProfile.weight / (heightM * heightM)) * 10) / 10;
            
            const dataToSave = {
                ...newProfile,
                activityLevel: 'moderate', // Ensure this is saved as the default
                dailyCalories: dailyCals,
                bmi: bmi,
                isSetup: true,
            };

            await setDoc(docRef, dataToSave);

            setProfile(p => ({ ...p, ...dataToSave }));
            // Set success state for the main app
            setMessage("Profile setup complete! Welcome to NutriScan.");
            // FIX 1: Set a short timeout to display the initial success message, then clear it.
            setTimeout(() => setMessage(null), 5000); 
            setShowProfileModal(false);
            setShowLoginState(false); 
            return true;
        } catch (e) {
            console.error("Error saving profile:", e);
            setError("Failed to save profile data.");
            return false;
        }
    };

    // --- CAMERA UTILITIES (Kept minimal for compatibility) ---

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
        if (videoRef.current) {
             videoRef.current.srcObject = null;
             videoRef.current.style.display = 'none'; 
        }
    }, []);

    const ensureVideoPlay = (videoElement) => {
        const attemptPlay = () => {
            if (!videoElement.srcObject) return;
            videoElement.style.display = 'block'; 

            if (videoElement.readyState >= 3) {
                videoElement.play().then(() => {
                    setIsCameraActive(true);
                }).catch(e => {
                    console.error("Video play failed:", e);
                    setError("Autoplay failed. Please ensure the browser window is active.");
                    setIsCameraActive(true); 
                });
            } else {
                setTimeout(attemptPlay, 100);
            }
        };
        attemptPlay();
    };

    const startCamera = useCallback(async () => {
        setError(null);
        setAnalysisResult(null);
        setLabelImage(null);
        setImagePreviewUrl(null);
        stopCamera();

        try {
            const constraints = {
                video: true
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.width = 640; // Explicit width
                videoRef.current.height = 480; // Explicit height
                videoRef.current.srcObject = stream;
                ensureVideoPlay(videoRef.current);
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            let userMessage = "Cannot access camera. Please check browser and device permissions.";
            if (err.name === 'NotAllowedError') {
                 userMessage = "Camera access denied. Please allow camera permissions.";
            } else if (err.name === 'NotFoundError') {
                 userMessage = "No camera found on your device.";
            }
            setError(userMessage);
            setIsCameraActive(false);
        }
    }, [stopCamera]);
    
    useEffect(() => {
        if (activeView !== 'analyzer' || scanMode !== 'camera') {
            stopCamera();
        }
        return () => stopCamera();
    }, [activeView, scanMode, stopCamera]);


    const takePhoto = useCallback(() => {
        if (!videoRef.current || !streamRef.current) {
            setError("Camera stream is not ready or has stopped.");
            return;
        }

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        
        const videoWidth = video.videoWidth > 0 ? video.videoWidth : video.clientWidth;
        const videoHeight = video.videoHeight > 0 ? video.videoHeight : video.clientHeight;

        if (videoWidth === 0 || videoHeight === 0) {
            setError("Camera stream video dimensions are zero. Try activating the camera again.");
            return;
        }

        canvas.width = videoWidth;
        canvas.height = videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                const capturedFile = new File([blob], "nutrition_label_scan.jpeg", { type: 'image/jpeg' });
                setLabelImage(capturedFile);
                setImagePreviewUrl(URL.createObjectURL(capturedFile));
                stopCamera();
            } else {
                setError("Failed to capture image data.");
            }
        }, 'image/jpeg', 0.95);

    }, [stopCamera]);

    // --- IMAGE HANDLING UTILITIES ---

    const fileToGenerativePart = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64Data = reader.result.split(',')[1];
                resolve({
                    inlineData: {
                        mimeType: file.type,
                        data: base64Data
                    }
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };
    
    // Function to map food names to icons/emojis
    const getFoodIcon = (foodName) => {
        const name = foodName.toLowerCase().trim();
        if (name.includes('oat')) return { icon: <Milk className="w-8 h-8 text-white" />, color: 'bg-yellow-600' };
        if (name.includes('chicken') || name.includes('fish') || name.includes('turkey')) return { icon: <Fish className="w-8 h-8 text-white" />, color: 'bg-sky-600' };
        if (name.includes('veg') || name.includes('salad') || name.includes('greens') || name.includes('spinach')) return { icon: <Leaf className="w-8 h-8 text-white" />, color: 'bg-green-600' };
        if (name.includes('fruit') || name.includes('apple') || name.includes('berry')) return { icon: <Apple className="w-8 h-8 text-white" />, color: 'bg-red-600' };
        if (name.includes('yogurt') || name.includes('dairy') || name.includes('milk')) return { icon: <Milk className="w-8 h-8 text-white" />, color: 'bg-indigo-600' };
        if (name.includes('egg')) return { icon: <Egg className="w-8 h-8 text-white" />, color: 'bg-yellow-400' };
        if (name.includes('beef') || name.includes('meat') || name.includes('steak')) return { icon: <Beef className="w-8 h-8 text-white" />, color: 'bg-red-700' };
        if (name.includes('bean') || name.includes('lentil') || name.includes('legume')) return { icon: <Utensils className="w-8 h-8 text-white" />, color: 'bg-amber-600' };
        if (name.includes('soup')) return { icon: <Soup className="w-8 h-8 text-white" />, color: 'bg-orange-600' };
        return { icon: <Carrot className="w-8 h-8 text-white" />, color: 'bg-emerald-600' };
    };

    const handleImageUpload = (e) => {
        setError(null);
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError("Please upload a valid image file (JPEG, PNG).");
                return;
            }
            setLabelImage(file);
            // FIX: Ensure URL is created and stored correctly
            setImagePreviewUrl(URL.createObjectURL(file)); 
            setAnalysisResult(null); 
        }
    };

    const clearImage = () => {
        setLabelImage(null);
        setImagePreviewUrl(null);
        setAnalysisResult(null);
        setError(null);
        stopCamera();
    };

    // --- FIRESTORE DATA LOGIC (Dashboard) ---

    const getDietLogCollectionRef = useCallback(() => {
        if (db && userId) {
            return collection(db, 'artifacts', appId, 'users', userId, 'nutriscan_log');
        }
        return null;
    }, [db, userId]);

    useEffect(() => {
        const colRef = getDietLogCollectionRef();
        let unsubscribe;

        if (colRef && isAuthReady && profile.isSetup) { // Only fetch if profile is set up
            const q = query(colRef, orderBy("timestamp", "desc"), limit(20));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setDietLog(logs);
            }, (error) => {
                console.error("Error fetching diet log:", error);
            });
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [getDietLogCollectionRef, isAuthReady, profile.isSetup]);

    /*const saveToDashboard = useCallback(async () => {
        if (!db || !userId || !analysisResult) {
            setMessage("Please analyze a label first.");
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const colRef = getDietLogCollectionRef();
            if (colRef) {
                await addDoc(colRef, {
                    ...analysisResult,
                    timestamp: serverTimestamp(),
                    userId: userId,
                    portionSize: portionSize,
                });
                
                
                if (analysisResult.overallRating === 'Avoid') {
                     showMotivationalPopup(200);
                } else {
                     setMessage("Analysis saved successfully to your Diet Log!");
                     setTimeout(() => setMessage(null), 3000);
                }

                showRandomFunFact();
                
            } else {
                 setError("Database connection is not ready. Cannot save data.");
                 
            }
        } catch (e) {
            console.error("Error saving to Firestore:", e);
            setError("Failed to save data. Please try again.");
        }finally{
            setIsSaving(false);
        }
    }, [analysisResult, db, userId, getDietLogCollectionRef, portionSize]);*/
    // Replace the current saveToDashboard function with this:
const saveToDashboard = useCallback(async () => {
  // Basic pre-checks
  if (!analysisResult) {
    setMessage("Please analyze a label first.");
    return;
  }
  if (!db || !userId) {
    setError("Database connection or user ID not ready. Please try again.");
    return;
  }

  const colRef = getDietLogCollectionRef();
  if (!colRef) {
    setError("Diet log collection not ready. Make sure you're signed in and profile is set up.");
    return;
  }

  setIsSaving(true);
  setError(null);

  try {
    // Save the analysis result to Firestore
    const docRef = await addDoc(colRef, {
      ...analysisResult,                // spread the result object
      timestamp: serverTimestamp(),     // server timestamp
      userId: userId,
      portionSize: portionSize,
    });

    // Option A (preferred): rely on onSnapshot listener to update dietLog.
    // If listener is slow, do a safe optimistic update using local timestamp
    // so the user sees their saved item immediately.
    const optimisticItem = {
      id: docRef.id,
      ...analysisResult,
      userId,
      portionSize,
      // Use a client-side timestamp for immediate display while serverTimestamp resolves
      timestamp: new Date()
    };

    setDietLog(prev => [optimisticItem, ...prev]);

    // Success feedback
    if (analysisResult.overallRating === 'Avoid') {
      showMotivationalPopup(200);
    } else {
      setMessage("Saved to your Diet Log!");
      setTimeout(() => setMessage(null), 3000);
    }
    showRandomFunFact();

  } catch (e) {
    console.error("Error saving to Firestore:", e);
    setError("Failed to save data. Please try again.");
  } finally {
    // ALWAYS clear saving state
    setIsSaving(false);
  }
}, [analysisResult, db, userId, portionSize, getDietLogCollectionRef]);



    // --- GEMINI API HANDLERS (Unchanged) ---

    const analyzeLabel = useCallback(async () => {
        if (!labelImage) {
            setError("Please capture or upload an image of a nutrition label to start the analysis.");
            return;
        }
        if (!profile.isSetup) {
             setError("Please set up your profile (Age, Weight, Height) first to get personalized analysis.");
             setShowProfileModal(true);
             return;
        }

        setIsAnalyzing(true);
        setAnalysisResult(null);
        setMealPlan(null);
        setError(null);
        setMessage(null);

        const imagePart = await fileToGenerativePart(labelImage);
        
        // FIX: Removed activityLevel from personalization context as it's defaulted now.
        const personalizationContext = `User Profile: Age=${profile.age}, Weight=${profile.weight}kg, Height=${profile.height}cm. Daily Calorie Goal: ${profile.dailyCalories} kcal (using moderate activity factor).`;

        const userQuery = `Perform OCR on this image. Extract all nutrition facts (calories, fat, carbs, sugars, protein) and the ingredients list. Then, based on the extracted text and the user's data (${personalizationContext}), analyze the product. Focus on excessive sodium, added sugar, and concerning additives relative to the user's ${profile.dailyCalories} kcal goal. Return the analysis in the requested JSON format ONLY.`;

        const systemPrompt = "You are NutriScan, a strict and objective nutritionist specializing in packaged foods. Your task is to analyze the provided nutrition label data from the image and return a JSON object containing your expert assessment. Do not use any text outside of the JSON structure. Base recommendations on the user's Daily Calorie Goal. IMPORTANT: For the 'healthyAlternatives' array, start each entry with the single food name that best represents the alternative (e.g., 'Oatmeal: Choose steel-cut oats...').";

        const payload = {
            contents: [{ parts: [imagePart, { text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        productName: { "type": "STRING", description: "Infer a descriptive product name if not explicitly stated (e.g., 'Frozen Dinner Meal', 'Sweetened Cereal')." },
                        overallRating: { "type": "STRING", "description": "Must be one of: 'Healthy', 'Moderate', or 'Avoid'." },
                        macroSummary: { "type": "STRING", "description": `1-2 sentence summary of key macros and how it fits the user's ${profile.dailyCalories} kcal goal.` },
                        concerns: { "type": "ARRAY", "items": { "type": "STRING" }, "description": "List of major concerns (e.g., specific additives, very high saturated fat, high sodium, high added sugar). List up to 3." },
                        healthyAlternatives: { "type": "ARRAY", "items": { "type": "STRING" }, "description": "3 brief, healthy alternative suggestions. Each entry must start with a single, representative food name, followed by a colon and the description." }
                    },
                    required: ["productName", "overallRating", "macroSummary", "concerns", "healthyAlternatives"]
                }
            }
        };

        const executeFetch = async (retryCount = 0) => {
            try {
                const response = await fetch(API_URL + API_KEY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (result.candidates && result.candidates.length > 0) {
                    const jsonString = result.candidates[0].content.parts[0].text;
                    const parsedJson = JSON.parse(jsonString);
                    setAnalysisResult(parsedJson);
                    showRandomFunFact();
                    return true;
                } else {
                    throw new Error("API returned no valid candidates.");
                }

            } catch (err) {
                console.error("API Call Error:", err);
                if (retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    console.log(`Retrying in ${delay / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    await executeFetch(retryCount + 1);
                } else {
                    setError("Failed to get a reliable analysis from the AI. Please ensure the label image is clear.");
                    
                }
            }
        };

        const success = await executeFetch();
        
        // This ensures the loading state stops whether successful or failed after retries
        setIsAnalyzing(false); 
        
        // Return overall success status of the whole operation
        return success;

        await executeFetch();
    }, [labelImage, profile]);


    // 2. AI Meal Plan Generator (Updated to request Markdown Table)
    const generateMealPlan = useCallback(async () => {
        if (!profile.isSetup) {
             setError("Please set up your profile first to generate a meal plan.");
             setShowProfileModal(true);
             return;
        }
        
        setIsGeneratingMealPlan(true);
        setError(null);
        setMealPlan(null);

        const personalizationContext = `Age=${profile.age}, Weight=${profile.weight}kg, Height=${profile.height}cm. Daily Calorie Goal: ${profile.dailyCalories} kcal (using moderate activity factor).`;

        const userQuery = `The user needs a healthy, 7-day meal plan based on their profile data: ${personalizationContext}. Keep the total daily calories within 100 kcal of the goal. Provide short, appetizing descriptions for each meal. IMPORTANT: Output the entire 7-day meal plan as a single, well-structured Markdown Table with columns: Day, Breakfast, Lunch, and Dinner. Do not include any introductory text or conclusions outside the table.`;

        const systemPrompt = "You are a professional chef and nutritionist. Generate a 7-day meal plan that is healthy, balanced, and perfectly tailored to the user's specific daily calorie requirement. Start the response with a title, then the required Markdown table.";

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: [{ "google_search": {} }], 
        };

        const executeFetch = async (retryCount = 0) => {
            try {
                const response = await fetch(API_URL + API_KEY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                const planText = result.candidates?.[0]?.content?.parts?.[0]?.text;

                if (planText) {
                    setMealPlan(planText);
                } else {
                    throw new Error("API returned no valid meal plan.");
                }

            } catch (err) {
                console.error("Meal Plan API Call Error:", err);
                if (retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    await executeFetch(retryCount + 1);
                } else {
                    setError("Failed to generate a meal plan. Try refreshing and checking your profile.");
                }
            } finally {
                setIsGeneratingMealPlan(false);
            }
        };

        await executeFetch();
    }, [profile]);


    // 3. AI Chatbot Nutritionist (Unchanged)
    const handleChat = useCallback(async (transcribedText = chatInput) => {
        // Use transcribedText if available (from voice input), otherwise use the typed chatInput
        const inputToProcess = transcribedText.trim();
        
        if (!inputToProcess || isChatting) return;
        
        // --- COMMAND CHECK (Mic button automatically uses this) ---
        if (processCommand(inputToProcess)) {
            setChatInput('');
            return;
        }

        const newUserMessage = { role: 'user', text: inputToProcess };
        const updatedHistory = [...chatHistory, newUserMessage];
        setChatHistory(updatedHistory);
        // FIX: Clear input here so user knows submission happened
        setChatInput(''); 
        setIsChatting(true);
        setError(null);

        const fullChatHistory = updatedHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const systemPrompt = "You are NutriBot, a friendly, non-judgemental, and highly informative AI Chatbot Nutritionist. Answer user questions concisely about healthy eating, specific ingredients, or general diet tips. Always be supportive.";

        const payload = {
            contents: fullChatHistory,
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        const executeFetch = async (retryCount = 0) => {
            try {
                const response = await fetch(API_URL + API_KEY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (result.candidates && result.candidates.length > 0 && result.candidates[0].content?.parts?.[0]?.text) {
                    const botResponseText = result.candidates[0].content.parts[0].text;
                    
                    // --- VOICE OUTPUT (TTS) ---
                    if ('speechSynthesis' in window) {
                        // FIX: Cancel any previous speech
                        if (window.speechSynthesis.speaking) {
                            window.speechSynthesis.cancel();
                        }
                        
                        const utterance = new SpeechSynthesisUtterance(botResponseText);
                        
                        utterance.onstart = () => setIsSpeaking(true);
                        utterance.onend = () => setIsSpeaking(false);
                        utterance.onerror = () => setIsSpeaking(false);
                        
                        window.speechSynthesis.speak(utterance);
                    }
                    // --- END VOICE OUTPUT ---
                    
                    setChatHistory(h => [...h, { role: 'model', text: botResponseText }]);
                } else {
                    throw new Error("API returned an invalid or empty response.");
                }

            } catch (err) {
                console.error("Chat API Call Error:", err);
                if (retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    await executeFetch(retryCount + 1);
                } else {
                    setChatHistory(h => [...h, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again later!" }]);
                }
                
            } finally {
                setIsChatting(false);
            }
        };

        await executeFetch();
    }, [chatInput, chatHistory, isChatting]);
    
    // --- VOICE INPUT (Speech Recognition) & COMMAND HANDLING ---

    const processCommand = useCallback((command) => {
        const lowerCommand = command.toLowerCase().trim();
        
        if (lowerCommand.includes('scan') || lowerCommand.includes('analyzer') || lowerCommand.includes('analyse')) {
            setActiveView('analyzer');
            setMessage(`Command recognized: 'Scan'. Switch to Analyzer view.`);
        } else if (lowerCommand.includes('sugar level') || lowerCommand.includes('sugar') || lowerCommand.includes('dashboard')) {
            setActiveView('dashboard');
            setMessage(`Command recognized: 'Show Dashboard'. Note: Sugar levels are tracked in individual logs.`);
        } else if (lowerCommand.includes('meal plan') || lowerCommand.includes('diet plan') || lowerCommand.includes('goals') || lowerCommand.includes('profile')) {
             setActiveView('profile');
            setMessage(`Command recognized: 'Show Goals'. Viewing Profile where you can generate a personalized plan.`);
        } else {
            return false;
        }
        setTimeout(() => setMessage(null), 5000);
        return true;
    }, []);
    
    // NEW FUNCTION: Stop TTS playback
    const stopVoicePlayback = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const startVoiceInput = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setChatHistory(h => [...h, { role: 'model', text: "❌ **Voice not supported** on this device. Please try typing." }]);
            return;
        }

        if (isVoiceListening) {
            speechRecognitionRef.current.stop();
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.lang = 'en-US';
        speechRecognitionRef.current = recognition;

        recognition.onstart = () => {
            setIsVoiceListening(true);
            // Visual Feedback: Input box turns red and says listening
            setMessage(null);
            setChatInput(''); // Clear previous input before listening
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setChatInput(transcript);
            
            // Auto-submission logic: Stop recognition and trigger submission
            recognition.stop(); 
            
            // FIX: This ensures the submission happens *after* the state update
            setTimeout(() => {
                // Pass the transcribed text directly to handleChat
                handleChat(transcript); 
            }, 50); 
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event);
            
            // Critical Error Handling: If access is blocked (NotAllowedError)
            if (event.error === 'not-allowed') {
                setChatHistory(h => [...h, { role: 'model', text: "❌ **Microphone Access Blocked.** Please check your browser's security settings (look for the lock icon 🔒) and allow microphone access for this site to use voice input." }]);
            } else {
                setChatHistory(h => [...h, { role: 'model', text: `❌ Voice recognition failed. Error: ${event.error}. Please try typing.` }]);
            }
            setIsVoiceListening(false);
            setChatInput('');
        };
        
        recognition.onend = () => {
            setIsVoiceListening(false);
            // Clear the visual feedback if input wasn't submitted
            if (chatInput === '🎤 LISTENING... Speak now.') {
                 setChatInput('');
            }
        };

        try {
             recognition.start();
        } catch (e) {
             console.error('Recognition start error:', e);
             setIsVoiceListening(false);
             setChatHistory(h => [...h, { role: 'model', text: "❌ Could not start microphone. Ensure no other application is using it." }]);
        }
    }, [isVoiceListening, handleChat, setChatInput, chatInput]); // Included chatInput in dependencies

    // Handler for Chatbot Mic Button (Voice Feature)
    const handleMicCommand = () => {
        // If TTS is speaking, stop it first
        if (isSpeaking) {
            stopVoicePlayback();
            return;
        }
        
        if (!isVoiceListening) {
            // Start listening if currently inactive
            startVoiceInput();
        } else {
            // Stop listening if currently active
            speechRecognitionRef.current?.stop();
        }
    };
    
    // --- FORM SUBMISSION HANDLERS ---
    
    // Handler for Chatbot Form (Enter key / Send button)
    const handleFormSubmit = (e) => {
        e.preventDefault();
        
        // If voice is active, stop it before processing text input
        if (isVoiceListening) {
            speechRecognitionRef.current?.stop();
        }
        
        // Check if the chat input is a command when hitting ENTER or SEND button
        if (processCommand(chatInput)) {
             setChatInput('');
             return;
        }
        
        // Default behavior: submit as a chat message
        if (!chatInput.trim() || isChatting) return;
        handleChat();
    };


    // --- UI Components ---
    const RatingBadge = ({ rating }) => {
        let color = 'bg-gray-400';
        let text = 'Unrated';
        let Icon = Gauge;

        if (rating === 'Healthy') {
            color = 'bg-emerald-500';
            text = 'Healthy Choice';
            Icon = CheckCircle;
        } else if (rating === 'Moderate') {
            color = 'bg-yellow-500';
            text = 'Moderate Consumption';
            Icon = AlertTriangle;
        } else if (rating === 'Avoid') {
            color = 'bg-red-500';
            text = 'High Concern: Avoid';
            Icon = XCircle;
        }

        return (
            <div className={`p-4 rounded-xl shadow-lg flex flex-col items-center justify-center text-white ${color}`}>
                <Icon className="w-10 h-10 mb-2" />
                <span className="font-bold text-lg">{text}</span>
            </div>
        );
    };

    const Card = ({ title, children, className = '' }) => (
        <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md ${className}`}>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-100 border-b dark:border-gray-700 pb-2">{title}</h3>
            {children}
        </div>
    );
    
    // --- MARKDOWN TO HTML RENDERER (Updated to handle symbols) ---
    const renderMarkdown = (markdownText) => {
        if (!markdownText) return null;

        const lines = markdownText.split('\n');
        let html = '';
        let inTable = false;
        
        lines.forEach(line => {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
                // Potential table line
                if (!inTable) {
                    // Start of table (or header/separator)
                    html += '<div class="overflow-x-auto"><table class="w-full text-sm text-left border-collapse">';
                    inTable = true;
                }
                
                // Check for separator line (---|---|---)
                if (trimmedLine.match(/\|[:\- ]*\|/)) {
                    // Skip separator line
                    return; 
                }

                // Process row, aggressively stripping symbols
                const cells = trimmedLine.split('|').slice(1, -1).map(c => 
                    c.trim()
                     // Aggressively remove common symbols used by AI for formatting ($, *, #)
                     .replace(/\*|#|$/g, '')
                     .trim()
                );
                
                // Determine if we are rendering header or body
                if (!html.includes('<thead>') || html.includes('</thead><tbody>') === false) { 
                    // Assume the first non-separator, non-title row is the header
                    html += '<thead><tr>' + cells.map(c => `<th scope="col" class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">${c}</th>`).join('') + '</tr></thead><tbody>';
                } else {
                     // Data row
                     html += '<tr>' + cells.map(c => `<td class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">${c}</td>`).join('') + '</tr>';
                }
                return; // Line processed
            } 
            
            // If we were inside a table and the line isn't a table line, close the table
            if (inTable) {
                html += '</tbody></table></div>';
                inTable = false;
            }

            // Simple text rendering for title (assuming title is the first non-table line)
            if (trimmedLine.length > 0 && !html.includes('<h4')) { // Check for h4 instead of h1
                html += `<h4 class="text-lg font-bold mb-3 text-gray-800 dark:text-gray-100">${trimmedLine}</h4>`;
            } else if (trimmedLine.length > 0) {
                 html += `<p class="mb-2 text-gray-700 dark:text-gray-300">${trimmedLine}</p>`;
            }
        });
        
        // Close table if still open at the end
        if (inTable) {
            html += '</tbody></table></div>';
        }

        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };
    
    // --- CHAT MARKDOWN PARSER (New for NutriBot) ---
    const parseChatMarkdown = (text) => {
        if (!text) return null;

        // 1. Handle bold text: **text** or *text* -> <strong>text</strong>
        let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

        // 2. Handle simple headings: # Heading -> <h4>Heading</h4>
        html = html.replace(/^#\s*(.*)$/gm, '<h4>$1</h4>'); 

        // 3. Handle list items: - item or * item -> <ul><li>item</li>...</ul>
        // This is complex, so we'll just handle it line by line for now
        const lines = html.split('\n');
        let processedLines = [];
        let inList = false;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                const content = trimmedLine.substring(2).trim();
                processedLines.push(`<li>${content}</li>`);
            } else {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                // Handle line breaks within the paragraph structure
                if (trimmedLine.length > 0) {
                     processedLines.push(`<p>${trimmedLine}</p>`);
                }
            }
        });

        if (inList) {
            processedLines.push('</ul>');
        }

        const finalHtml = processedLines.join('');
        
        // Clean up empty lines created by splits/joins before returning
        return <div dangerouslySetInnerHTML={{ __html: finalHtml.replace(/<p><\/p>/g, '') }} />;
    };


    // --- VIEW RENDERERS ---

    const renderAnalyzer = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                <Image className="w-6 h-6 mr-2 text-emerald-60" />
                Scan & Analyze Label
            </h2>

            <p className="text-gray-600 dark:text-gray-400">
                Choose to "Capture" a new photo of the label or "Upload" an existing image.
            </p>

            {/* Scan Mode Selector */}
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-xl p-1 shadow-inner">
                <button
                    onClick={() => setScanMode('camera')}
                    className={`flex-1 flex items-center justify-center py-2 rounded-lg font-semibold transition-colors ${
                        scanMode === 'camera' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                    <Camera className="w-5 h-5 mr-2" /> Live Scan
                </button>
                <button
                    onClick={() => { setScanMode('upload'); stopCamera(); }}
                    className={`flex-1 flex items-center justify-center py-2 rounded-lg font-semibold transition-colors ${
                        scanMode === 'upload' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                    <Upload className="w-5 h-5 mr-2" /> Upload Image
                </button>
            </div>

            {/* Content based on Scan Mode */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border dark:border-gray-600 border-gray-200 min-h-[250px] flex flex-col justify-center items-center">
                {scanMode === 'camera' && !imagePreviewUrl && (
                    <div className="w-full">
                        {!isCameraActive && (
                            <button
                                onClick={startCamera}
                                disabled={isAnalyzing}
                                className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition flex items-center justify-center"
                            >
                                <Camera className="w-5 h-5 mr-2" /> Activate Camera
                            </button>
                        )}
                        {isCameraActive && (
                            <div className="relative w-full overflow-hidden rounded-lg shadow-lg">
                                <video ref={videoRef} autoPlay playsInline muted className="w-full object-cover rounded-lg camera-feed"></video> 
                                <button
                                    onClick={takePhoto}
                                    disabled={isAnalyzing}
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 p-3 bg-red-500 text-white rounded-full shadow-xl hover:bg-red-600 transition"
                                    aria-label="Take Photo"
                                >
                                    <Camera className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                        {!isCameraActive && !error && (
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-4 text-center">Click "Activate Camera" to begin scanning.</p>
                        )}
                        
                    </div>
                )}

                {scanMode === 'upload' && !imagePreviewUrl && (
                     <div className="w-full">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            id="image-upload"
                            disabled={isAnalyzing}
                        />
                        <label 
                            htmlFor="image-upload" 
                            className={`w-full py-4 rounded-lg font-semibold text-gray-600 dark:text-gray-300 border-2 border-dashed border-gray-300 dark:border-gray-600 transition duration-200 flex items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                isAnalyzing ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700'
                            }`}
                        >
                            <Upload className="w-5 h-5 mr-2" /> Select Image File
                        </label>
                    </div>
                )}
                
                {/* Image Preview for both modes */}
                {imagePreviewUrl && (
                    <div className="relative w-full rounded-lg bg-white dark:bg-gray-800 shadow-lg">
                        <img 
                            src={imagePreviewUrl} 
                            alt="Nutrition Label Preview" 
                            className="w-full h-auto max-h-80 object-contain rounded-md"
                        />
                        <button
                            onClick={clearImage}
                            className="absolute top-4 right-4 bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600 transition"
                            disabled={isAnalyzing}
                            aria-label="Clear Image"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>
                )}

                {!imagePreviewUrl && scanMode === 'upload' && (
                     <p className="text-gray-500 dark:text-gray-400 text-sm mt-4 text-center">No image selected.</p>
                )}
            </div>
            
            {/* Portion Size Estimator Simulation */}
             <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border dark:border-gray-700">
                <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center mb-2">
                    <Sparkles className="w-4 h-4 mr-2 text-yellow-500" /> AI Portion Size (Simulated)
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Select the estimated amount you plan to consume:
                </p>
                <select
                    value={portionSize}
                    onChange={(e) => setPortionSize(e.target.value)}
                    className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                    disabled={isAnalyzing}
                >
                    <option value="1 serving">1 Serving (Default)</option>
                    <option value="half serving">1/2 Serving</option>
                    <option value="double serving">2 Servings</option>
                    <option value="triple serving">3 Servings</option>
                </select>
            </div>


            <button
                onClick={analyzeLabel}
                disabled={isAnalyzing || !labelImage || !profile.isSetup}
                className={`w-full py-3 rounded-xl font-semibold text-white transition duration-200 shadow-lg flex items-center justify-center ${
                    isAnalyzing || !profile.isSetup ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'
                }`}
            >
                {isAnalyzing ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Analyzing Label... (AI doing OCR)
                    </>
                ) : (
                    <>
                        <Zap className="w-5 h-5 mr-2" />
                        Get AI Analysis
                    </>
                )}
            </button>

            {/* Fun Fact Display */}
            {funFact && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-purple-600 text-white rounded-full shadow-xl z-30 text-sm animate-pulse">
                    <span className="font-semibold mr-2">💡 Fun Fact:</span>
                    <span className="block sm:inline">{funFact}</span>
                </div>
            )}


            {/* Removed the persistent success message display from here based on request */}
            {error && (
                <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded relative" role="alert">
                    <span className="block sm:inline">Error: {error}</span>
                </div>
            )}

            {analysisResult && (
                <div className="mt-8 space-y-6">
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{analysisResult.productName} Analysis</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <RatingBadge rating={analysisResult.overallRating} />
                        </div>

                        <Card title="Summary" className="md:col-span-2">
                            <p className="text-gray-700 dark:text-gray-300">
                                {analysisResult.macroSummary} 
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mt-1">
                                    Your Portion: {portionSize}
                                </span>
                            </p>
                            <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                <button
                                    onClick={saveToDashboard}
                                    disabled={isSaving}
                                    className={`text-sm py-2 px-4 rounded-full font-medium transition duration-150 flex items-center ${
                                        isSaving ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
                                    }`}
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart className="w-4 h-4 mr-2" />}
                                    {isSaving ? 'Saving...' : 'Save to Diet Log'}
                                </button>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Major Concerns">
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                {analysisResult.concerns.map((concern, index) => (
                                    <li key={index} className="flex items-start">
                                        <XCircle className="w-5 h-5 mr-2 text-red-500 mt-1 flex-shrink-0" />
                                        <span>{concern}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <Card title="Healthy Alternatives">
                            <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                                {analysisResult.healthyAlternatives.map((alt, index) => {
                                    const [foodName = 'Unknown', description = alt] = alt.split(/:(.*)/s).map(s => s.trim());
                                    const { icon: FoodIcon, color: iconColor } = getFoodIcon(foodName);

                                    return (
                                        <li key={index} className="flex items-start bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border dark:border-gray-600">
                                            <div className={`flex-shrink-0 mr-3 w-12 h-12 rounded-full flex items-center justify-center border-2 border-emerald-400 ${iconColor}`}>
                                                {FoodIcon}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-gray-100">{foodName}</p>
                                                <p className="text-sm">{description}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );

    const renderDashboard = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                <BarChart className="w-6 h-6 mr-2 text-emerald-60" />
                Today's Diet Log
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
                Your consumption snapshot for today. Track your progress toward your "{profile.dailyCalories} kcal" goal.
            </p>

            {/* Stats Calculation (Simplified for display) */}
            {(() => {
                const today = new Date();//.toISOString().split('T')[0];
                
                const isToday = (timestamp) => {
                    let logDate;
                    if (!timestamp) return false;
                    if (timestamp.toDate) {
                        logDate = timestamp.toDate();
                    } else if (timestamp.seconds) {
                        logDate = new Date(timestamp.seconds * 1000);
                    }else if (timestamp instanceof Date) {
                        logDate = timestamp;
                    }else {
                        return false;
                    }
                    const year = today.getFullYear();
                    const month = today.getMonth();
                    const day = today.getDate();
                    
                    return logDate.getDate() === today.getDate() &&
                           logDate.getMonth() === today.getMonth() &&
                           logDate.getFullYear() === today.getFullYear();
                };

                const todayLog = dietLog.filter(item => isToday(item.timestamp));
                
                /*const todayLog = dietLog.filter(item => {
                    if (item.timestamp) {
                        let date;
                        // FIX: Safely convert Firebase Timestamp or use Date object if possible
                        if (item.timestamp.toDate) {
                            date = item.timestamp.toDate();
                        } else if (item.timestamp.seconds) {
                            date = new Date(item.timestamp.seconds * 1000);
                        } else {
                            // If timestamp is malformed, assume it's an old log and skip
                            return false;
                        }
                        return date.toISOString().split('T')[0] === today;
                        /*const date = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000);
                        return date.toISOString().split('T')[0] === today;
                    }
                    return false;
                });*/

                const totalItems = todayLog.length;
                const totalAvoid = todayLog.filter(item => item.overallRating === 'Avoid').length;
                const score = todayLog.reduce((acc, item) => {
                    if (item.overallRating === 'Healthy') return acc + 3;
                    if (item.overallRating === 'Moderate') return acc + 1;
                    if (item.overallRating === 'Avoid') return acc - 2;
                    return acc;
                }, 0);

                return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-emerald-100 dark:bg-emerald-900 rounded-xl shadow-sm text-center">
                            <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-300">{totalItems}</p>
                            <p className="text-sm text-emerald-700 dark:text-emerald-200">Total Items Logged</p>
                        </div>
                        <div className="p-4 bg-red-100 dark:bg-red-900 rounded-xl shadow-sm text-center">
                            <p className="text-4xl font-bold text-red-600 dark:text-red-300">{totalAvoid}</p>
                            <p className="text-sm text-red-700 dark:text-red-200">Items to Avoid</p>
                        </div>
                        <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-xl shadow-sm text-center">
                            <p className="text-4xl font-bold text-blue-600 dark:text-blue-300">{score}</p>
                            <p className="text-sm text-blue-700 dark:text-blue-200">Health Score Today</p>
                        </div>
                    </div>
                );
            })()}

            <Card title="Recent Activity Log">
                {dietLog.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 italic">Start analyzing and saving labels to build your diet log!</p>
                ) : (
                    <div className="space-y-3">
                        {dietLog.map((log) => {
                            const date = log.timestamp ? (log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp.seconds * 1000)) : new Date();
                            let ratingColor = log.overallRating === 'Healthy' ? 'text-emerald-500' : log.overallRating === 'Moderate' ? 'text-yellow-500' : 'text-red-500';

                            return (
                                <div key={log.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-100">{log.productName}</p>
                                        <p className={`text-xs font-medium ${ratingColor}`}>
                                            {log.overallRating} 
                                            <span className="text-gray-500 dark:text-gray-400 ml-2">({log.portionSize})</span>
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {date.toLocaleDateString()}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );

    const renderChatbot = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                <MessageSquare className="w-6 h-6 mr-2 text-emerald-60" />
                AI Chatbot Nutritionist (NutriBot)
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
                Ask NutriBot anything about nutrition, ingredients, diet tips, or healthy food choices.
            </p>

            <div className="h-[50vh] bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border dark:border-gray-600 border-gray-200 overflow-y-auto flex flex-col space-y-4 shadow-inner">
                {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <Utensils className="w-8 h-8 mb-2" />
                        <p className="text-sm">Start a conversation with your personal nutritionist!</p>
                        <p className="text-xs mt-1">Type a command or question below.</p>
                    </div>
                )}
                {chatHistory.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-xs sm:max-w-md p-3 rounded-xl shadow-md text-sm ${
                                msg.role === 'user'
                                    ? 'bg-emerald-500 text-white rounded-br-none'
                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none border dark:border-gray-700 border-gray-200'
                            }`}
                        >
                            {/* Use the new Markdown parser for attractive formatting */}
                            {msg.role === 'user' ? msg.text : parseChatMarkdown(msg.text)}
                        </div>
                    </div>
                ))}
                {isChatting && (
                     <div className="flex justify-start">
                        <div className="max-w-xs sm:max-w-md p-3 rounded-xl bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-tl-none border dark:border-gray-700 border-gray-200 shadow-md">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                            <span className="text-sm">NutriBot is typing...</span>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleFormSubmit} className="flex space-x-3">
                <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className={`chat-input-box flex-grow p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 border-gray-300 rounded-xl focus:ring-emerald-600 focus:border-emerald-600 transition duration-150 ${isVoiceListening ? 'border-red-500 placeholder-red-500' : ''}`}
                    placeholder={isVoiceListening ? '🎤 LISTENING... Speak now.' : 'Type a command or message...'}
                    disabled={isChatting}
                />
                <button
                    type="submit"
                    disabled={isChatting || !chatInput.trim()}
                    className={`p-3 rounded-xl transition duration-200 shadow-md flex items-center justify-center ${
                        isChatting || !chatInput.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'
                    }`}
                    aria-label="Send Message"
                >
                    <Send className="w-5 h-5 text-white" />
                </button>
                
                {/* NEW STOP VOICE BUTTON (Visible only when TTS is speaking) */}
                {isSpeaking && (
                    <button
                        type="button"
                        onClick={stopVoicePlayback}
                        className={`p-3 rounded-xl transition duration-200 shadow-md flex items-center justify-center bg-red-500 hover:bg-red-600 active:scale-[0.98]`}
                        aria-label="Stop Voice Playback"
                    >
                        <XCircle className="w-5 h-5 text-white" />
                    </button>
                )}

                <button
                    type="button" 
                    onClick={handleMicCommand} // Calls the dedicated Mic command handler
                    disabled={isChatting}
                    className={`p-3 rounded-xl transition duration-200 shadow-md flex items-center justify-center ${
                        isChatting ? 'bg-gray-400 cursor-not-allowed' : isVoiceListening ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600 active:scale-[0.98]'
                    }`}
                    aria-label="Voice Input"
                >
                    <Mic className="w-5 h-5 text-white" />
                </button>
            </form>
        </div>
    );
    
    const renderProfile = () => {
        const BmiCategory = (bmi) => {
            if (bmi === 0) return <span className="text-gray-500 font-semibold">Awaiting Setup</span>;
            if (bmi < 18.5) return <span className="text-yellow-500 font-semibold">Underweight</span>;
            if (bmi >= 18.5 && bmi < 24.9) return <span className="text-emerald-500 font-semibold">Normal Weight</span>;
            if (bmi >= 25 && bmi < 29.9) return <span className="text-orange-500 font-semibold">Overweight</span>;
            if (bmi >= 30) return <span className="text-red-500 font-semibold">Obese</span>;
            return <span className="text-gray-500">N/A</span>;
        };
        
        const ActivityDisplay = ({ level }) => {
            const map = {
                sedentary: 'Sedentary (Little to no exercise)',
                light: 'Lightly Active (1-3 days/week)',
                moderate: 'Moderately Active (3-5 days/week)',
                very_active: 'Very Active (6-7 days/week)',
                extra_active: 'Extra Active (Daily intense exercise)',
            };
            return map[level] || 'N/A';
        };

        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-between">
                    <span className="flex items-center"><User className="w-6 h-6 mr-2 text-emerald-60" /> User Profile & Goals</span>
                    <button 
                        onClick={() => setShowProfileModal(true)}
                        className="text-sm py-1 px-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
                    >
                        Edit Profile
                    </button>
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Your metabolic data is used to tailor all meal suggestions and label analysis.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card title="Daily Calorie Goal" className="col-span-1 bg-emerald-50 dark:bg-emerald-900 shadow-lg">
                        <p className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-300">{profile.dailyCalories}</p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-200">kcal per day (BMR Adjusted)</p>
                    </Card>
                    <Card title="Body Mass Index (BMI)" className="col-span-1">
                        <p className="text-4xl font-extrabold text-gray-800 dark:text-gray-100">{profile.bmi}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{BmiCategory(profile.bmi)}</p>
                    </Card>
                    <Card title="Activity Level" className="col-span-1">
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-100 capitalize">{profile.activityLevel.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400"><ActivityDisplay level={profile.activityLevel} /></p>
                    </Card>
                </div>
                
                <Card title="Personalized Meal Plan" className="mt-8">
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                        A custom 7-day meal plan based on your **{profile.dailyCalories} kcal** daily requirement.
                    </p>
                    
                    <button
                        onClick={generateMealPlan}
                        disabled={isGeneratingMealPlan}
                        className={`py-2 px-4 rounded-lg font-semibold text-white transition duration-200 shadow-md flex items-center ${
                            isGeneratingMealPlan ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-[0.98]'
                        }`}
                    >
                        {isGeneratingMealPlan ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Generating Plan...
                            </>
                        ) : (
                            <>
                                <Utensils className="w-5 h-5 mr-2" />
                                Generate 7-Day Meal Plan
                            </>
                        )}
                    </button>
                    
                    {mealPlan && (
                        // Use the new Markdown renderer for attractive table display
                        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
                            {renderMarkdown(mealPlan)}
                        </div>
                    )}
                </Card>
            </div>
        );
    };


    const renderContent = () => {
        if (!isAuthReady || showLoginScreen) {
             return <LoginScreen onLogin={handleLogin} isAuthenticating={!isAuthReady} />;
        }
        if (!profile.isSetup && !showProfileModal) {
             // If login is done but profile isn't setup, force the modal via state
              setShowProfileModal(true);
        }

        switch (activeView) {
            case 'analyzer':
                return renderAnalyzer();
            case 'dashboard':
                return renderDashboard();
            case 'chatbot':
                return renderChatbot();
            case 'profile':
                return renderProfile();
            default:
                return renderAnalyzer();
        }
    };
    
    // --- MODALS ---
    
    // New: Login Screen Component
    const LoginScreen = ({ onLogin, isAuthenticating }) => (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl">
            <h1 className="text-6xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-4 tracking-tighter">
                NutriScan
            </h1>
            <p className="text-xl text-gray-700 dark:text-gray-300 mb-8">
                Your personalized nutrition guide.
            </p>
            
            {isAuthenticating ? (
                <div className="flex items-center text-emerald-600 dark:text-emerald-400">
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    <span className="font-medium">Securing connection...</span>
                </div>
            ) : (
                <button
                    onClick={onLogin}
                    className="py-3 px-8 bg-emerald-600 text-white text-lg font-semibold rounded-full shadow-xl hover:bg-emerald-700 transition duration-300 transform hover:scale-[1.03]"
                >
                    Start Analysis (Guest Access)
                </button>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-600 mt-4">
                No sign-up required. Your data is saved securely.
            </p>
        </div>
    );
    
    // Updated: Profile Setup Wizard Component (2 steps now)
    const ProfileSetupModal = () => {
        // FIX: Wizard is now only 2 steps (1 and 2)
        const [currentStep, setCurrentStep] = useState(1);
        const [tempProfile, setTempProfile] = useState(profile);
        const [modalError, setModalError] = useState(null); 
        
        if (!showProfileModal) return null;

        const handleProfileChange = (e) => {
            const { name, value } = e.target;

            let newValue = value;
            if (name === 'age' || name === 'weight' || name === 'height') {
                 newValue = (value === '' || value === undefined) ? 0 : parseFloat(value); 
            }
            setTempProfile(p => ({
                ...p,
                [name]: newValue
            }));
            setModalError(null); 
        };
        
        // FIX: Simplified validation for 2 steps
        const isStepValid = () => {
            if (currentStep === 1 && !tempProfile.gender) return false;
            
            if (currentStep === 2) {
                const age = Number(tempProfile.age);
                const weight = Number(tempProfile.weight);
                const height = Number(tempProfile.height);
                
                // Ensure all fields are finite numbers and greater than zero
                if (!isFinite(age) || age <= 0) return false;
                if (!isFinite(weight) || weight <= 0) return false;
                if (!isFinite(height) || height <= 0) return false;
            }
            return true;
        };
        
        const goToNextStep = () => {
            if (isStepValid()) {
                setModalError(null);
                // FIX: Advance only if currentStep is 1 (since max step is 2)
                if (currentStep === 1) setCurrentStep(2);
            } else {
                 setModalError("Please complete the required information before proceeding.");
            }
        };
        const handleFinalSave = async () => {
            // Check if the current step is valid before attempting save
            if (!isStepValid()) { 
                 setModalError("Please ensure all profile details are entered as valid numbers.");
                 return;
            }
            
            // Set error message immediately if validation passes but the save is about to start
            setModalError(null); 
            const profileToSave = {
                ...tempProfile,
                /*age: Number(tempProfile.age),
                weight: Number(tempProfile.weight),
                height: Number(tempProfile.height),*/
                age: isFinite(tempProfile.age) ? Number(tempProfile.age) : 0,
                weight: isFinite(tempProfile.weight) ? Number(tempProfile.weight) : 0,
                height: isFinite(tempProfile.height) ? Number(tempProfile.height) : 0,
            };

            // Use the main app's saveProfile function
            // The success variable will be TRUE if the save was successful, FALSE otherwise.
            const success = await saveProfile(profileToSave); 
            
            if (success) {
                setShowProfileModal(false);
            }else {
                setModalError("Failed to save profile. Please try again.");
            }
        };
        /*const handleFinalSave = async () => {
            // Re-validate final step (Step 2) immediately before saving
            if (!isStepValid()) { 
                 setModalError("Please complete all profile details before finishing.");
                 return;
            }

            // Use the main app's saveProfile function
            const success = await saveProfile(tempProfile);
            if (!success) {
                // If save fails, the main app's setError will handle it, but we clear modal's error here.
                 setModalError(null); 
            }
        };*/
        
        const renderStepContent = () => {
            switch (currentStep) {
                case 1:
                    return (
                        <div className="text-center">
                            <h4 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100">Step 1: Your Identity</h4>
                            <p className="text-md text-gray-600 dark:text-gray-400 mb-6">First, tell us your gender for accurate BMR calculation.</p>
                            <div className="flex justify-center space-x-6">
                                {/* Male Selection */}
                                <button
                                    onClick={() => setTempProfile(p => ({ ...p, gender: 'male' }))}
                                    className={`p-6 rounded-xl transition duration-200 shadow-lg ${
                                        tempProfile.gender === 'male' ? 'bg-blue-500 ring-4 ring-blue-300 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:shadow-xl'
                                    }`}
                                >
                                    <span className="text-5xl">👨</span>
                                    <p className="font-semibold mt-2">Male</p>
                                </button>
                                {/* Female Selection */}
                                <button
                                    onClick={() => setTempProfile(p => ({ ...p, gender: 'female' }))}
                                    className={`p-6 rounded-xl transition duration-200 shadow-lg ${
                                        tempProfile.gender === 'female' ? 'bg-pink-500 ring-4 ring-pink-300 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:shadow-xl'
                                    }`}
                                >
                                    <span className="text-5xl">👩</span>
                                    <p className="font-semibold mt-2">Female</p>
                                </button>
                            </div>
                        </div>
                    );
                case 2:
                    // FIX: This is now the final step
                    return (
                        <div className="space-y-4">
                            <h4 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Step 2: Key Metrics</h4>
                            
                            {/* Age */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Age (Years)</label>
                                <input type="number" name="age" value={tempProfile.age || ''} onChange={handleProfileChange} className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg mt-1 transition duration-150 focus:border-emerald-600" min="1" required placeholder="e.g., 30" />
                            </div>

                            {/* Weight */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Weight (kg)</label>
                                <input type="number" name="weight" value={tempProfile.weight || ''} onChange={handleProfileChange} className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg mt-1 transition duration-150 focus:border-emerald-600" min="1" required placeholder="e.g., 75" />
                            </div>

                            {/* Height */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Height (cm)</label>
                                <input type="number" name="height" value={tempProfile.height || ''} onChange={handleProfileChange} className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg mt-1 transition duration-150 focus:border-emerald-600" min="1" required placeholder="e.g., 175" />
                            </div>
                            
                            {/* Note about Activity Level */}
                            <p className="text-xs text-gray-500 dark:text-gray-400 pt-4">
                                *Note: Activity Level is defaulted to **'Moderate'** for simplified BMR calculation.
                            </p>
                        </div>
                    );
                default:
                    return null;
            }
        };

        return (
            // FIX: Added max-h-full and overflow-y-auto to allow the modal body to scroll if content is too tall
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-2xl w-full max-w-lg transform transition duration-300 max-h-full">
                    
                    {/* Header & Step Indicator */}
                    <div className="flex justify-between items-center mb-6 border-b pb-4 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                        <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            Goal Setup Wizard
                        </h3>
                        {/* FIX: Steps are now 1/2 or 2/2 */}
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Step {currentStep} of 2
                        </div>
                    </div>
                    
                    {/* Content (Scrollable Area) */}
                    <div className="min-h-[250px] flex items-center justify-center">
                        {renderStepContent()}
                    </div>
                    
                    {/* Navigation */}
                    {/* FIX: Navigation now handles only 2 steps */}
                    <div className="mt-8 flex justify-between items-center pt-4 border-t dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 z-10">
                        <button
                            onClick={() => { setCurrentStep(currentStep - 1); setModalError(null); }}
                            disabled={currentStep === 1}
                            className={`py-2 px-4 rounded-full font-semibold transition duration-150 flex items-center ${currentStep === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 dark:text-gray-300 hover:text-emerald-600'}`}
                        >
                            <ArrowRight className="w-5 h-5 mr-1 transform rotate-180" /> Back
                        </button>
                        
                        {/* Display Modal Specific Error */}
                        {modalError && <p className="text-red-500 text-xs text-center">{modalError}</p>}
                        
                        {currentStep < 2 ? (
                            <button
                                onClick={goToNextStep}
                                disabled={!isStepValid()}
                                className={`py-3 px-6 rounded-full font-semibold text-white transition duration-200 shadow-md flex items-center ${
                                    isStepValid() ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed'
                                }`}
                            >
                                Next <ArrowRight className="w-5 h-5 ml-2" />
                            </button>
                        ) : (
                             <button
                                onClick={handleFinalSave}
                                disabled={!isStepValid()}
                                className={`py-3 px-6 rounded-full font-semibold text-white transition duration-200 shadow-xl flex items-center ${
                                    isStepValid() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                                }`}
                            >
                                <Zap className="w-5 h-5 mr-2" /> Finish & Analyze
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
            {/* Dark/Light Mode Toggle */}
            <div className="fixed top-4 right-4 z-10">
                <button
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-md border dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:ring-2 hover:ring-emerald-500 transition"
                    aria-label="Toggle Theme"
                >
                    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
            </div>
            
            <div className="max-w-4xl mx-auto p-4 pt-10">
                <header className="mb-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">NutriScan</h1>
                    {isAuthenticated && !showLoginScreen && (
                        <div className="flex space-x-2 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-md border dark:border-gray-700">
                            <button
                                onClick={() => setActiveView('analyzer')}
                                className={`py-2 px-4 rounded-lg font-semibold text-sm transition-colors ${activeView === 'analyzer' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                Analyzer
                            </button>
                            <button
                                onClick={() => setActiveView('dashboard')}
                                className={`py-2 px-4 rounded-lg font-semibold text-sm transition-colors ${activeView === 'dashboard' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                Log
                            </button>
                            <button
                                onClick={() => setActiveView('profile')}
                                className={`py-2 px-4 rounded-lg font-semibold text-sm transition-colors ${activeView === 'profile' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                Goals
                            </button>
                            <button
                                onClick={() => setActiveView('chatbot')}
                                className={`py-2 px-4 rounded-lg font-semibold text-sm transition-colors ${activeView === 'chatbot' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                NutriBot AI
                            </button>
                        </div>
                    )}
                </header>

                {/* Main Content Area */}
                <main className="pb-24">
                    {renderContent()}
                </main>
                
                {/* Persistent Message Bar */}
                {message && (
                    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-green-500 text-white rounded-full shadow-xl z-30 text-sm">
                        {message}
                    </div>
                )}

                {/* Profile Setup Modal Overlay */}
                <ProfileSetupModal />
            </div>
        </div>
    );
};

export default App;
