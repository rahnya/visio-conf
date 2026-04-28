/*Author : Matthieu BIVILLE*/

import { useAppContext } from "@/context/AppContext";
import { useEffect, useRef, useState } from "react";
import styles from "./UserDisplay.module.css"
import { Pencil, Trash2, Power } from "lucide-react";
import CustomSnackBar from "../../SnackBar";
import UserListDisplay from "./UserListDisplay";
import { User } from "@/types/User";
import UpdateUserRole from "./UpdateUserRole";
import CreateUser from "./CreateUser";

export default function HomeUserGestion ({userPerms} : {userPerms : string[]}) {
    const [createUser, setCreateUser] = useState<boolean>(false);
    const [regex, setRegex] = useState<string>("");
    const [userList, setUserList] = useState<User[]>();
    const [selectedUser, setSelectedUser] = useState<any>();
    const [rows, setRows] = useState<any>();

    const [openChangeStatus, setOpenChangeStatus] = useState<boolean>(false);
    const [openAlert, setOpenAlert] = useState<boolean>(false);
    const [updateUser, setUpdateUser] = useState<boolean>(false);
    const [alertSeverity, setAlertSeverity] = useState<"success" | "error" | "warning" | "info">("success");
    const [alertMessage, setAlertMessage] = useState<string>("");
    const [action, setAction] = useState<string>("");

    const nomDInstance = "Home User Gestion"
    const { controleur, canal } = useAppContext()

    const listeMessageEmis = useRef([
        "users_list_request",
        "update_user_status_request",
        "update_user_roles_request",
        "create_user_request"
    ]).current

    const listeMessageRecus = useRef([
        "users_list_response",
        "update_user_status_response",
        "update_user_roles_response",
        "create_user_response"
    ]).current

    // Un seul objet ref pour tous les setters — mis à jour à chaque render
    const state = useRef({
        setCreateUser,
        setUserList,
        setOpenChangeStatus,
        setAlertMessage,
        setAlertSeverity,
        setOpenAlert,
    })
    state.current = { setCreateUser, setUserList, setOpenChangeStatus, setAlertMessage, setAlertSeverity, setOpenAlert }

    // Handler stable (même référence pour toute la vie du composant)
    const handler = useRef({
        nomDInstance,
        traitementMessage: (msg: {
            users_list_response?: any,
            update_user_status_response?: any,
            update_user_roles_response?: any,
            create_user_response?: any
        }) => {
            console.log("📩 MESSAGE FRONT REÇU dans HomeUserGestion handler", msg)
            const s = state.current
            if (msg.users_list_response) {
                s.setUserList(msg.users_list_response.users)
            }
            if (msg.update_user_status_response) {
                const usedAction = msg.update_user_status_response.action
                s.setOpenChangeStatus(false)
                s.setAlertMessage(`Utilisateur ${usedAction === "activate" ? "activé" : usedAction === "deactivate" ? "désactivé" : "banni"} avec succès !`)
                s.setAlertSeverity("success")
                s.setOpenAlert(true)
            }
            if (msg.update_user_roles_response) {
                s.setAlertMessage(`Rôle de l'utilisateur mis à jour avec succès !`)
                s.setAlertSeverity("success")
                s.setOpenAlert(true)
            }
            if (msg.create_user_response) {
                console.log("🎉 create_user_response reçu :", msg.create_user_response)
                if (msg.create_user_response.success) {
                    s.setCreateUser(false)
                    s.setAlertMessage(`Utilisateur créé ! Mot de passe temporaire : ${msg.create_user_response.tempPassword}`)
                    s.setAlertSeverity("success")
                    s.setOpenAlert(true)
                } else {
                    s.setAlertMessage(msg.create_user_response.message || "Erreur lors de la création de l'utilisateur")
                    s.setAlertSeverity("error")
                    s.setOpenAlert(true)
                }
            }
        },
    }).current

    // Inscription unique — le handler reste inscrit tant que le composant est monté
    useEffect(() => {
        if (controleur && canal) {
            controleur.inscription(handler, listeMessageEmis, listeMessageRecus)
            controleur.envoie(handler, { "users_list_request": 1 })
        }
        return () => {
            if (controleur) {
                controleur.desincription(handler, listeMessageEmis, listeMessageRecus)
            }
        }
    }, [controleur, canal])

    // Recharge la liste après fermeture du modal de statut ou retour de l'éditeur de rôle
    useEffect(() => {
        if (controleur && !openChangeStatus) {
            controleur.envoie(handler, { "users_list_request": 1 })
        }
    }, [openChangeStatus])

    useEffect(() => {
        if (controleur && !createUser) {
            controleur.envoie(handler, { "users_list_request": 1 })
        }
    }, [createUser])
    
    useEffect(() => {
        if (controleur && !updateUser) {
            controleur.envoie(handler, { "users_list_request": 1 })
        }
    }, [updateUser])

    useEffect(() => {
        setRows([])
        const newRows: any[] = []
        userList?.forEach((user) => {
            if (
                (user.firstname + " " + user.lastname).toLowerCase().includes(regex)
                && user.status !== "banned"
            ) {
                newRows.push({
                    id: user.id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    phone: user.phone,
                    job: user.job,
                    desc: user.desc,
                    status: user.status === "active" ? "Actif" : user.status === "waiting" ? "En attente" : "Désactivé",
                    roles: user.roles.map((r: any) => r._id)
                })
            }
        })
        setRows(newRows)
    }, [userList, regex])

    const columns = [
        { field: 'firstname', headerName: 'Prénom', flex: 1, renderCell: (params: any) => <div className={styles.rowLabel}>{params.value}</div> },
        { field: 'lastname', headerName: "Nom", flex: 1, renderCell: (params: any) => <div className={styles.rowLabel}>{params.value}</div> },
        { field: 'email', headerName: "Email", flex: 2, renderCell: (params: any) => <div className={styles.rowLabel}>{params.value}</div> },
        { field: 'status', headerName: "Status", flex: 1, renderCell: (params: any) => <div className={styles.rowLabel}>{params.value}</div> },
        {
            field: 'action', headerName: 'Actions', flex: 1,
            renderCell: (params: any) => (
                <div className={styles.rowIcons}>
                    <div
                        style={{ backgroundColor: userPerms.includes("admin_modifier_utilisateur") ? "#223A6A" : "gray" }}
                        className={styles.iconContainer}
                        onClick={() => { if (userPerms.includes("admin_modifier_utilisateur")) { setSelectedUser(params.row); setUpdateUser(true) } }}
                    >
                        <Pencil size={22} color="white" />
                    </div>
                    <div
                        style={{ backgroundColor: userPerms.includes("admin_desactiver_utilisateur") ? (params.row.status === "Actif" ? "#e07b00" : "#00bd13") : "gray" }}
                        className={styles.iconContainer}
                        onClick={() => { if (userPerms.includes("admin_desactiver_utilisateur")) { setAction(params.row.status === "Actif" ? "deactivate" : "activate"); setSelectedUser(params.row); setOpenChangeStatus(true) } }}
                    >
                        <Power size={22} color="white" />
                    </div>
                    <div
                        style={{ backgroundColor: userPerms.includes("admin_supprimer_utilisateur") ? "#CB0000" : "gray" }}
                        className={styles.iconContainer}
                        onClick={() => { if (userPerms.includes("admin_supprimer_utilisateur")) { setAction("ban"); setSelectedUser(params.row); setOpenChangeStatus(true) } }}
                    >
                        <Trash2 size={22} color="white" />
                    </div>
                </div>
            )
        },
    ]

    const handleChangeStatus = () => {
        controleur.envoie(handler, {
            "update_user_status_request": { user_id: selectedUser.id, action }
        })
    }

    if (!updateUser && !createUser) {
        return (
            <>
                {userPerms.includes("admin_demande_liste_utilisateurs") && (
                    <UserListDisplay
                        regex={regex}
                        setRegex={setRegex}
                        rows={rows}
                        columns={columns}
                        setCreateUser={setCreateUser}
                        openChangeStatus={openChangeStatus}
                        setOpenChangeStatus={setOpenChangeStatus}
                        selectedUser={selectedUser}
                        handleChangeStatus={handleChangeStatus}
                        openAlert={openAlert}
                        setOpenAlert={setOpenAlert}
                        action={action}
                    />
                )}
                <CustomSnackBar open={openAlert} setOpen={setOpenAlert} msg={alertMessage} severity={alertSeverity} />
            </>
        )
    } else if (updateUser) {
        return <UpdateUserRole user={selectedUser} setUpdateUser={setUpdateUser} />
    } else {
        // On passe le handler déjà inscrit à CreateUser — pas besoin qu'il se réinscrive
        return <CreateUser setCreateUser={setCreateUser} handler={handler} />
    }
}