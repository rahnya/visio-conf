/*Author : Matthieu BIVILLE*/

import { useAppContext } from "@/context/AppContext";
import { useEffect, useRef, useState } from "react";
import styles from "./UserDisplay.module.css"
import { TextField } from "@mui/material";
import { ArrowLeft } from "lucide-react";

export default function CreateUser ({setCreateUser, handler: parentHandler} : {setCreateUser : Function, handler: any}) {
    const [firstname, setFirstname] = useState<string>("");
    const [lastname, setLastname] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [phone, setPhone] = useState<string>("");
    const [job, setJob] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const { controleur, canal } = useAppContext();

    // CreateUser s'inscrit lui-même pour create_user_request et create_user_response.
    // Ainsi, même si HomeUserGestion est démonté, la réponse arrive bien ici.
    const listeMessageEmis = useRef(["create_user_request"]).current
    const listeMessageRecus = useRef(["create_user_response"]).current

    const setLoadingRef = useRef(setLoading)
    const setErrorRef = useRef(setError)
    const setCreateUserRef = useRef(setCreateUser)
    setLoadingRef.current = setLoading
    setErrorRef.current = setError
    setCreateUserRef.current = setCreateUser

    const handler = useRef({
        nomDInstance: "Create User",
        traitementMessage: (msg: { create_user_response?: any }) => {
            console.log("📩 CreateUser handler reçoit :", msg)
            if (msg.create_user_response) {
                setLoadingRef.current(false)
                if (msg.create_user_response.success) {
                    // On ferme le formulaire — HomeUserGestion gère le snackbar via son propre handler
                    setCreateUserRef.current(false)
                } else {
                    setErrorRef.current(msg.create_user_response.message || "Erreur lors de la création de l'utilisateur")
                }
            }
        }
    }).current

    useEffect(() => {
        if (controleur && canal) {
            controleur.inscription(handler, listeMessageEmis, listeMessageRecus)
        }
        return () => {
            if (controleur) {
                controleur.desincription(handler, listeMessageEmis, listeMessageRecus)
            }
        }
    }, [controleur, canal])

    const validateForm = () => {
        if (!firstname.trim()) { setError("Le prénom est requis"); return false }
        if (!lastname.trim()) { setError("Le nom est requis"); return false }
        if (!email.trim()) { setError("L'email est requis"); return false }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) { setError("L'email n'est pas valide"); return false }
        return true
    }

    const handleSubmit = () => {
        setError("")
        if (!validateForm()) return
        setLoading(true)
        controleur.envoie(handler, {
            "create_user_request": {
                firstname: firstname.trim(),
                lastname: lastname.trim(),
                email: email.trim(),
                phone: phone.trim(),
                job: job.trim(),
                desc: description.trim()
            }
        })
    }

    return (
        <div className={styles.container}>
            <div style={{display: "flex", alignItems: "center", columnGap: "20px", marginBottom: "40px"}}>
                <button
                    onClick={() => setCreateUser(false)}
                    style={{backgroundColor: "transparent", border: "none", cursor: "pointer", padding: 0}}
                >
                    <ArrowLeft size={32} color="#223A6A" />
                </button>
                <h1 style={{fontSize: "32px", fontWeight: 700, margin: 0}}>Créer un utilisateur</h1>
            </div>

            <div style={{maxWidth: "600px"}}>
                {error && (
                    <div style={{backgroundColor: "#ffebee", color: "#c62828", padding: "12px 16px", borderRadius: "4px", marginBottom: "20px", fontSize: "14px"}}>
                        {error}
                    </div>
                )}

                <TextField label="Prénom" value={firstname} onChange={(e) => setFirstname(e.target.value)} fullWidth margin="normal" placeholder="Entrez le prénom" disabled={loading} />
                <TextField label="Nom" value={lastname} onChange={(e) => setLastname(e.target.value)} fullWidth margin="normal" placeholder="Entrez le nom" disabled={loading} />
                <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth margin="normal" placeholder="Entrez l'email" disabled={loading} />
                <TextField label="Téléphone (optionnel)" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth margin="normal" placeholder="Entrez le téléphone" disabled={loading} />
                <TextField label="Fonction (optionnel)" value={job} onChange={(e) => setJob(e.target.value)} fullWidth margin="normal" placeholder="Entrez la fonction" disabled={loading} />
                <TextField label="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth margin="normal" placeholder="Entrez une description" multiline rows={4} disabled={loading} />

                <div style={{display: "flex", gap: "15px", marginTop: "30px"}}>
                    <button
                        onClick={() => setCreateUser(false)}
                        style={{backgroundColor: "#0698D6", color: "white", padding: "10px 30px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px", fontWeight: 500}}
                        disabled={loading}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{backgroundColor: "#223A6A", color: "white", padding: "10px 30px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px", fontWeight: 500}}
                        disabled={loading}
                    >
                        {loading ? "Création..." : "Créer"}
                    </button>
                </div>
            </div>
        </div>
    )
}